"""Runtime-backed dashboard data service."""

from __future__ import annotations

import asyncio
from collections import deque
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
import hashlib
import re
from typing import Any

import pandas as pd

from quant_agent.agents.base import AgentContext
from quant_agent.agents.executor import ExecutorAgent, OrderStatus
from quant_agent.agents.researcher import ResearcherAgent
from quant_agent.agents.risk_manager import RiskManagerAgent
from quant_agent.agents.strategist import SignalType, StrategistAgent, _normalize_brackets
from quant_agent.api.demo_service import DashboardDemoService
from quant_agent.api.persistence import RuntimeStateStore
from quant_agent.backtest.engine import BacktestEngine
from quant_agent.core.llm import get_llm
from quant_agent.core.memory import AgentMemory
from quant_agent.core.tools import ToolRegistry
from quant_agent.data.providers import get_market_data_provider

A_SHARE_NAMES = {
    "600519.SS": "贵州茅台",
    "000858.SZ": "五粮液",
    "601318.SS": "中国平安",
    "600036.SS": "招商银行",
    "000333.SZ": "美的集团",
    "002594.SZ": "比亚迪",
}

CHART_INTERVAL_CONFIG: dict[str, dict[str, Any]] = {
    "1m": {"period": "5d", "yf_interval": "1m", "max_points": 360},
    "5m": {"period": "1mo", "yf_interval": "5m", "max_points": 360},
    "15m": {"period": "2mo", "yf_interval": "15m", "max_points": 320},
    "30m": {"period": "3mo", "yf_interval": "30m", "max_points": 320},
    "60m": {"period": "6mo", "yf_interval": "60m", "max_points": 320},
    "1d": {"period": "5y", "yf_interval": "1d", "max_points": 1250},
    "1w": {"period": "10y", "yf_interval": "1wk", "max_points": 520},
    "1M": {"period": "max", "yf_interval": "1mo", "max_points": 240},
}


def _iso(dt: datetime) -> str:
    return dt.astimezone(UTC).isoformat()


@dataclass
class PositionRecord:
    symbol: str
    quantity: float
    avg_price: float
    market_value: float
    pnl: float
    pnl_percent: float
    day_change: float
    day_change_percent: float
    name: str
    sector: str


class DashboardRuntimeService:
    """Builds dashboard payloads from the actual backend runtime state."""

    def __init__(
        self,
        market: str | None = None,
        symbols: list[str] | None = None,
        strategy: str = "fortress",
        capital: float = 100_000.0,
        refresh_interval_seconds: int = 120,
        state_store: RuntimeStateStore | None = None,
    ) -> None:
        self.symbols = symbols or ["AAPL", "MSFT", "GOOGL", "NVDA", "AMZN", "TSLA"]
        self.strategy = strategy.strip().lower() or "fortress"
        self.capital = capital
        self.refresh_interval_seconds = refresh_interval_seconds
        inferred_market = "A" if any(symbol.endswith((".SS", ".SZ")) for symbol in self.symbols) else "US"
        normalized_market = (market or inferred_market).upper()
        self.market = normalized_market if normalized_market in {"A", "US"} else inferred_market
        self._state_key_prefix = f"{self.market.lower()}:{self.strategy}:"
        self._shared_state_key_prefix = f"{self.market.lower()}:"

        self._llm = get_llm()
        self._memory = AgentMemory()
        self._tools = ToolRegistry()
        self._provider = get_market_data_provider(self.market)
        self._researcher = ResearcherAgent(self._llm, self._tools, self._memory)
        self._strategist = StrategistAgent(self._llm, self._memory)
        self._risk_manager = RiskManagerAgent(self._llm, self._memory)
        self._executor = ExecutorAgent(self._llm, self._memory)
        self._fallback = DashboardDemoService()
        self._state_store = state_store or RuntimeStateStore()

        self._logs: deque[dict[str, Any]] = deque(maxlen=100)
        self._snapshot: dict[str, Any] = self._fallback.snapshot()
        self._signal_overrides: dict[str, dict[str, Any]] = {}
        self._watchlist: list[dict[str, Any]] = []
        self._paper_settings: dict[str, Any] = {
            "autoTradingEnabled": False,
            "maxAutoSignalsPerRefresh": 2,
            "lastAutoRunAt": None,
            "lastResetAt": None,
            "capital": capital,
        }
        self._last_refresh: datetime | None = None
        self._lock = asyncio.Lock()

        self._set_context()
        self._restore_state()

    async def get_snapshot(self, force_refresh: bool = False) -> dict[str, Any]:
        await self._ensure_fresh(force_refresh=force_refresh)
        return self._snapshot

    async def get_portfolio(self) -> dict[str, Any]:
        return (await self.get_snapshot())["portfolio"]

    async def get_markets(self) -> list[dict[str, Any]]:
        return (await self.get_snapshot())["markets"]

    async def get_signals(self) -> list[dict[str, Any]]:
        return (await self.get_snapshot())["signals"]

    async def get_agents(self) -> list[dict[str, Any]]:
        return (await self.get_snapshot())["agents"]

    async def get_trades(self) -> list[dict[str, Any]]:
        return (await self.get_snapshot())["trades"]

    async def get_risk(self) -> dict[str, Any]:
        return (await self.get_snapshot())["risk"]

    async def get_alerts(self) -> list[dict[str, Any]]:
        return (await self.get_snapshot())["alerts"]

    async def get_logs(self) -> list[dict[str, Any]]:
        return (await self.get_snapshot())["logs"]

    async def get_historical(self) -> list[dict[str, Any]]:
        return (await self.get_snapshot())["historicalData"]

    async def get_daily_history(self) -> list[dict[str, Any]]:
        return (await self.get_snapshot())["dailyHistory"]

    async def get_chart(self, symbol: str | None = None, interval: str = "1d") -> dict[str, Any]:
        await self.get_snapshot()
        target_symbol = symbol or self._default_symbol()
        return await asyncio.to_thread(self._build_chart_payload, target_symbol, interval)

    async def get_news(self, symbol: str | None = None) -> list[dict[str, Any]]:
        await self.get_snapshot()
        target_symbol = symbol or self._default_symbol()
        return await asyncio.to_thread(self._build_news_items, target_symbol)

    async def get_watchlist(self) -> list[dict[str, Any]]:
        return list(self._watchlist)

    async def get_paper_account(self) -> dict[str, Any]:
        return (await self.get_snapshot()).get("paperAccount", {})

    async def add_watchlist_symbol(self, symbol: str) -> list[dict[str, Any]]:
        normalized = await asyncio.to_thread(self._normalize_watchlist_symbol, symbol)
        if not normalized:
            raise ValueError("symbol is required")

        if any(str(item.get("symbol", "")).upper() == normalized for item in self._watchlist):
            return list(self._watchlist)

        is_valid = await asyncio.to_thread(self._validate_watchlist_symbol, normalized)
        if not is_valid:
            raise ValueError(f"unknown symbol: {symbol}")

        resolved_name = await asyncio.to_thread(self._resolve_symbol_name, normalized)
        entry = {
            "symbol": normalized,
            "name": resolved_name,
            "addedAt": _iso(datetime.now(UTC)),
        }
        self._ensure_symbol_in_universe(normalized)
        self._watchlist.insert(0, entry)
        self._persist_state()
        return list(self._watchlist)

    async def remove_watchlist_symbol(self, symbol: str) -> list[dict[str, Any]]:
        normalized = symbol.strip().upper()
        self._watchlist = [
            item for item in self._watchlist if str(item.get("symbol", "")).upper() != normalized
        ]
        self._persist_state()
        return list(self._watchlist)

    async def approve_signal(self, signal_id: str) -> dict[str, Any]:
        return await self._update_signal_status(signal_id, "APPROVED")

    async def reject_signal(self, signal_id: str) -> dict[str, Any]:
        return await self._update_signal_status(signal_id, "REJECTED")

    async def update_paper_settings(
        self,
        *,
        auto_trading_enabled: bool | None = None,
        capital: float | None = None,
    ) -> dict[str, Any]:
        await self._ensure_fresh()
        async with self._lock:
            if auto_trading_enabled is not None:
                self._paper_settings["autoTradingEnabled"] = bool(auto_trading_enabled)
                self._append_log(
                    agent_id="agent-system",
                    agent_name="System",
                    level="info",
                    message=f"Paper auto-trading {'enabled' if auto_trading_enabled else 'disabled'} for {self.strategy}",
                    details={"autoTradingEnabled": bool(auto_trading_enabled), "strategy": self.strategy},
                )
            if capital is not None:
                self.capital = float(capital)
                self._paper_settings["capital"] = self.capital
                self._set_context()
                self._append_log(
                    agent_id="agent-system",
                    agent_name="System",
                    level="info",
                    message=f"Paper capital updated to {self.capital:.2f}",
                    details={"capital": self.capital, "strategy": self.strategy},
                )
            await self._rebuild_snapshot_views()
            self._persist_state()
            return dict(self._snapshot.get("paperAccount", {}))

    async def reset_paper_account(self) -> dict[str, Any]:
        async with self._lock:
            now = datetime.now(UTC)
            self._executor.restore_state({})
            self._risk_manager.restore_state({})
            self._signal_overrides = {}
            self.capital = float(self._paper_settings.get("capital", self.capital) or self.capital)
            self._set_context()
            self._paper_settings["lastResetAt"] = _iso(now)
            self._snapshot = self._fallback.snapshot()
            self._logs.clear()
            self._append_log(
                agent_id="agent-system",
                agent_name="System",
                level="warning",
                message="Paper account reset completed",
                details={"strategy": self.strategy, "market": self.market},
                timestamp=now,
            )
            self._last_refresh = None
            await self._refresh_snapshot(allow_auto_execute=False)
            self._persist_state()
            return dict(self._snapshot.get("paperAccount", {}))

    async def place_manual_order(
        self,
        *,
        symbol: str,
        side: str,
        quantity: float,
        limit_price: float,
        stop_loss: float | None = None,
        target_price: float | None = None,
    ) -> dict[str, Any]:
        await self._ensure_fresh()
        async with self._lock:
            now = datetime.now(UTC)
            normalized_symbol = await asyncio.to_thread(self._normalize_watchlist_symbol, symbol)
            if not normalized_symbol:
                raise ValueError("symbol is required")
            is_valid = await asyncio.to_thread(self._validate_watchlist_symbol, normalized_symbol)
            if not is_valid:
                raise ValueError(f"unknown symbol: {symbol}")
            self._ensure_symbol_in_universe(normalized_symbol)
            await asyncio.to_thread(self._ensure_market_entry, normalized_symbol)

            normalized_side = side.strip().upper()
            if normalized_side not in {"BUY", "SELL"}:
                raise ValueError("side must be BUY or SELL")
            if quantity <= 0:
                raise ValueError("quantity must be greater than 0")
            if limit_price <= 0:
                raise ValueError("price must be greater than 0")
            signal_type = SignalType.BUY if normalized_side == "BUY" else SignalType.SELL
            normalized_stop, normalized_target = _normalize_brackets(
                signal_type,
                float(limit_price),
                float(stop_loss) if stop_loss and stop_loss > 0 else None,
                float(target_price) if target_price and target_price > 0 else None,
                default_stop_loss_pct=StrategistAgent.DEFAULT_STOP_LOSS_PCT,
                risk_reward_ratio=StrategistAgent.MIN_RISK_REWARD_RATIO,
            )

            signal_payload = {
                "symbol": normalized_symbol,
                "signal_type": normalized_side.lower(),
                "confidence": 0.95,
                "entry_price": float(limit_price),
                "target_price": float(normalized_target or limit_price),
                "stop_loss": float(normalized_stop or limit_price),
                "rationale": "Manual paper order from terminal ticket",
                "timeframe": "manual",
                "risk_reward_ratio": 1.0,
                "position_size_pct": min((float(quantity) * float(limit_price)) / max(self.capital, 1.0), 1.0),
                "metadata": {
                    "strategy": "manual",
                    "source": "manual-ticket",
                    "manual": True,
                },
            }
            execution = await self._executor.execute(
                "place_order",
                signal=signal_payload,
                quantity=float(quantity),
                order_type="limit",
            )
            if not execution.get("success"):
                raise ValueError(str(execution.get("execution", {}).get("message") or execution.get("error") or "manual order failed"))

            self._append_log(
                agent_id="agent-executor",
                agent_name="Executor",
                level="success",
                message=f"Manual {normalized_side} order for {normalized_symbol}",
                details={
                    "symbol": normalized_symbol,
                    "side": normalized_side,
                    "quantity": float(quantity),
                    "price": float(limit_price),
                    "execution": execution,
                },
                timestamp=now,
            )
            await self._rebuild_snapshot_views(now=now)
            self._persist_state()
            return {
                "success": True,
                "paperAccount": dict(self._snapshot.get("paperAccount", {})),
                "order": execution.get("order", {}),
                "execution": execution.get("execution", {}),
            }

    async def close_paper_position(self, symbol: str) -> dict[str, Any]:
        await self._ensure_fresh()
        async with self._lock:
            normalized_symbol = symbol.strip().upper()
            markets = list(self._snapshot.get("markets", []))
            market_price = next(
                (
                    float(market.get("price") or 0.0)
                    for market in markets
                    if str(market.get("symbol", "")).upper() == normalized_symbol
                ),
                0.0,
            )
            if market_price <= 0:
                chart_payload = await asyncio.to_thread(self._build_chart_payload, normalized_symbol, "1d")
                market_price = float(chart_payload.get("quote", {}).get("price", 0.0) or 0.0)
            if market_price <= 0:
                raise ValueError(f"no market price available for {normalized_symbol}")

            result = self._executor.close_position(normalized_symbol, market_price)
            events = list(result.get("events", []))
            if not events:
                await self._rebuild_snapshot_views()
                self._persist_state()
                return {
                    "success": True,
                    "symbol": normalized_symbol,
                    "alreadyClosed": True,
                    "paperAccount": dict(self._snapshot.get("paperAccount", {})),
                    "portfolio": dict(self._snapshot.get("portfolio", {})),
                    "events": [],
                }

            now = datetime.now(UTC)
            for event in events:
                pnl = float(event.get("pnl", 0.0) or 0.0)
                self._risk_manager.register_trade_outcome(normalized_symbol, pnl)
                self._append_log(
                    agent_id="agent-executor",
                    agent_name="Executor",
                    level="success" if pnl >= 0 else "warning",
                    message=f"Manual close for {normalized_symbol} at {market_price:.2f}",
                    details=event,
                    timestamp=now,
                )

            await self._rebuild_snapshot_views()
            self._persist_state()
            return {
                "success": True,
                "symbol": normalized_symbol,
                "paperAccount": dict(self._snapshot.get("paperAccount", {})),
                "portfolio": dict(self._snapshot.get("portfolio", {})),
                "events": events,
            }

    async def _ensure_fresh(self, force_refresh: bool = False) -> None:
        if not force_refresh and self._snapshot_should_refresh():
            force_refresh = True

        if not force_refresh and self._last_refresh is not None:
            age = (datetime.now(UTC) - self._last_refresh).total_seconds()
            if age < self.refresh_interval_seconds:
                return

        async with self._lock:
            if not force_refresh and self._snapshot_should_refresh():
                force_refresh = True

            if not force_refresh and self._last_refresh is not None:
                age = (datetime.now(UTC) - self._last_refresh).total_seconds()
                if age < self.refresh_interval_seconds:
                    return
            await self._refresh_snapshot()

    async def _refresh_snapshot(self, allow_auto_execute: bool = True) -> None:
        now = datetime.now(UTC)
        self._last_refresh = now
        self._set_context()

        try:
            research = await self._researcher.execute("market_overview")
            markets = self._build_markets(research)
            current_prices = {
                str(market["symbol"]): float(market.get("price") or 0.0)
                for market in markets
            }

            management = await self._executor.execute("manage_positions", current_prices=current_prices)
            for event in management.get("events", []):
                symbol = str(event.get("symbol", ""))
                pnl = float(event.get("pnl", 0.0) or 0.0)
                reason = str(event.get("reason", "exit"))
                price = float(event.get("price", 0.0) or 0.0)
                quantity = float(event.get("quantity", 0.0) or 0.0)
                if reason == "partial_exit":
                    self._risk_manager.update_pnl(pnl)
                else:
                    self._risk_manager.register_trade_outcome(symbol, pnl)
                self._append_log(
                    agent_id="agent-executor",
                    agent_name="Executor",
                    level="success" if pnl >= 0 else "warning",
                    message=f"Managed exit for {symbol}: {reason} at {price:.2f} on {quantity:.4f}",
                    details=event,
                    timestamp=now - timedelta(seconds=15),
                )

            self._append_log(
                agent_id="agent-researcher",
                agent_name="Researcher",
                level="info",
                message=f"Completed market analysis for {len(markets)} symbols",
                details={"symbols": [market["symbol"] for market in markets]},
                timestamp=now - timedelta(seconds=30),
            )

            signal_result = await self._strategist.execute("generate_signals", research_data=research)
            signals = await self._process_signals(signal_result.get("signals", []), markets)
            if allow_auto_execute:
                await self._auto_execute_pending_signals(signals, now)
            positions, cash_balance = self._build_positions(markets)
            self._risk_manager.sync_positions({position.symbol: abs(position.market_value) for position in positions})
            trades = self._build_trades()
            historical_data = await asyncio.to_thread(self._build_historical_data)
            risk = await self._build_risk(positions, historical_data)
            alerts = self._build_alerts(positions, risk)
            daily_history = await asyncio.to_thread(self._build_daily_history, positions)
            portfolio = self._build_portfolio(positions, cash_balance, historical_data)
            agents = self._build_agents(now, len(signals))
            paper_account = self._build_paper_account(portfolio, signals, trades, risk)

            self._snapshot = {
                "portfolio": portfolio,
                "markets": markets,
                "signals": signals,
                "agents": agents,
                "trades": trades,
                "risk": risk,
                "alerts": alerts,
                "logs": list(self._logs),
                "historicalData": historical_data,
                "dailyHistory": daily_history,
                "paperAccount": paper_account,
            }
            self._persist_state()
        except Exception as exc:
            self._append_log(
                agent_id="agent-system",
                agent_name="System",
                level="error",
                message=f"Runtime refresh failed, using fallback data: {exc}",
                details={"error": str(exc)},
            )
            fallback = self._fallback.snapshot()
            fallback["logs"] = list(self._logs) or fallback["logs"]
            fallback["paperAccount"] = self._build_paper_account(
                fallback.get("portfolio", {}),
                fallback.get("signals", []),
                fallback.get("trades", []),
                fallback.get("risk", {}),
            )
            self._snapshot = fallback
            self._persist_state()

    async def _process_signals(
        self,
        raw_signals: list[dict[str, Any]],
        markets: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        processed: list[dict[str, Any]] = []
        market_lookup = {market["symbol"]: market for market in markets}

        for index, signal in enumerate(raw_signals):
            signal_type = str(signal.get("signal_type", "hold")).upper()
            signal_enum = SignalType.BUY if signal_type == "BUY" else SignalType.SELL if signal_type == "SELL" else SignalType.HOLD
            entry_price = float(signal.get("entry_price") or 0)
            stop_loss, target_price = _normalize_brackets(
                signal_enum,
                entry_price,
                float(signal.get("stop_loss") or 0) or None,
                float(signal.get("target_price") or 0) or None,
                default_stop_loss_pct=StrategistAgent.DEFAULT_STOP_LOSS_PCT,
                risk_reward_ratio=StrategistAgent.MIN_RISK_REWARD_RATIO,
            )
            normalized_signal = {
                **signal,
                "entry_price": entry_price,
                "stop_loss": float(stop_loss or 0),
                "target_price": float(target_price or 0),
            }
            assessment = await self._risk_manager.execute(
                "assess_trade",
                signal=normalized_signal,
                current_price=entry_price,
            )
            status = "PENDING" if assessment.get("approved") else "REJECTED"
            signal_id = self._signal_id(normalized_signal)
            execution_details = None

            override = self._signal_overrides.get(signal_id)
            if override:
                status = str(override.get("status", status))

            api_signal = {
                "id": signal_id,
                "symbol": signal["symbol"],
                "type": signal_type,
                "confidence": round(float(signal.get("confidence", 0.0)), 2),
                "entryPrice": entry_price,
                "targetPrice": float(target_price or 0),
                "stopLoss": float(stop_loss or 0),
                "rationale": signal.get("rationale", ""),
                "timestamp": _iso(datetime.now(UTC) - timedelta(minutes=index * 5)),
                "status": status,
                "agentSource": "Strategist",
                "riskScore": round(float(assessment.get("risk_score", 0.0)) * 10, 1),
                "expectedReturn": self._expected_return_pct(
                    normalized_signal
                ),
                "quantity": self._suggested_quantity(normalized_signal),
                "strategy": str(signal.get("metadata", {}).get("strategy", self.strategy)),
                "warnings": list(assessment.get("warnings", [])),
                "cooldownUntil": assessment.get("cooldown_until"),
                "kellyFraction": round(float(assessment.get("kelly_fraction", signal.get("metadata", {}).get("kelly_fraction", 0.0)) or 0.0), 4),
                "portfolioHeat": round(float(assessment.get("portfolio_heat", 0.0) or 0.0), 4),
                "maxPositionSize": round(float(assessment.get("max_position_size", 0.0) or 0.0), 2),
                "tradingPaused": bool(assessment.get("trading_paused", False)),
                "metadata": dict(signal.get("metadata", {})),
            }
            processed.append(api_signal)

            market_name = market_lookup.get(signal["symbol"], {}).get("name", signal["symbol"])
            self._append_log(
                agent_id="agent-strategist",
                agent_name="Strategist",
                level="success" if status in {"APPROVED", "EXECUTED"} else "warning",
                message=f"Generated {signal_type} signal for {market_name}",
                details={"signal": api_signal, "assessment": assessment, "execution": execution_details},
            )

        if not processed:
            self._append_log(
                agent_id="agent-strategist",
                agent_name="Strategist",
                level="info",
                message="No tradeable signals met the current filters",
            )

        return processed

    def _build_markets(self, research: dict[str, Any]) -> list[dict[str, Any]]:
        markets: list[dict[str, Any]] = []

        for symbol, payload in research.get("symbols", {}).items():
            analysis = payload.get("analysis", {})
            market_data = analysis.get("market_data", {}).get("data", [])
            stock_info = analysis.get("stock_info", {})
            if len(market_data) < 2:
                continue

            latest = market_data[-1]
            previous = market_data[-2]
            price = float(latest.get("Close", 0))
            previous_close = float(previous.get("Close", price or 1))
            change = price - previous_close
            day_low = float(latest.get("Low", min(price, previous_close)))
            day_high = float(latest.get("High", max(price, previous_close)))

            markets.append(
                {
                    "symbol": symbol,
                    "name": A_SHARE_NAMES.get(symbol) or stock_info.get("name") or symbol,
                    "price": round(price, 2),
                    "change": round(change, 2),
                    "changePercent": round((change / previous_close) * 100, 2) if previous_close else 0.0,
                    "volume": int(latest.get("Volume", 0) or 0),
                    "high24h": round(day_high, 2),
                    "low24h": round(day_low, 2),
                    "open": round(float(latest.get("Open", previous_close)), 2),
                    "previousClose": round(previous_close, 2),
                    "sector": stock_info.get("sector", "Unknown"),
                }
            )

        return markets

    def _default_symbol(self) -> str:
        markets = self._snapshot.get("markets", [])
        if isinstance(markets, list) and markets:
            first_symbol = str(markets[0].get("symbol", ""))
            if first_symbol:
                return first_symbol
        tracked_symbols = self._tracked_symbols()
        return tracked_symbols[0]

    @staticmethod
    def _normalize_chart_interval(interval: str) -> str:
        normalized = interval if interval in CHART_INTERVAL_CONFIG else "1d"
        return normalized

    @staticmethod
    def _chart_time(value: Any) -> int:
        timestamp = pd.to_datetime(value, utc=True)
        if timestamp.tzinfo is None:
            timestamp = timestamp.tz_localize(UTC)
        return int(timestamp.timestamp())

    @staticmethod
    def _clean_number(value: Any, digits: int = 4) -> float | None:
        if value is None or pd.isna(value):
            return None
        return round(float(value), digits)

    def _build_chart_payload(self, symbol: str, interval: str) -> dict[str, Any]:
        normalized_interval = self._normalize_chart_interval(interval)
        config = CHART_INTERVAL_CONFIG[normalized_interval]
        history = self._provider.get_history(
            symbol,
            period=str(config["period"]),
            interval=str(config["yf_interval"]),
            auto_adjust=False,
        )
        if history.empty:
            raise RuntimeError(f"No chart data available for {symbol}")

        history = history.tail(int(config["max_points"])).reset_index()
        time_column = "Datetime" if "Datetime" in history.columns else "Date"
        history[time_column] = pd.to_datetime(history[time_column], utc=True)

        ohlcv = [
            {
                "time": self._chart_time(row[time_column]),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(float(row.get("Volume", 0) or 0)),
            }
            for _, row in history.iterrows()
        ]

        intraday = self._build_intraday_series(symbol)
        indicators = self._calculate_chart_indicators(history, time_column)
        quote = self._build_chart_quote(symbol, ohlcv[-1], ohlcv, intraday)
        depth = self._build_depth_ladder(symbol, quote)
        ticks = self._build_tick_tape(symbol, intraday)
        market_name = next(
            (market.get("name") for market in self._snapshot.get("markets", []) if market.get("symbol") == symbol),
            None,
        ) or A_SHARE_NAMES.get(symbol) or symbol

        return {
            "symbol": symbol,
            "name": market_name,
            "market": self.market,
            "interval": normalized_interval,
            "lastUpdated": _iso(datetime.now(UTC)),
            "quote": quote,
            "ohlcv": ohlcv,
            "intraday": intraday,
            "indicators": indicators,
            "depth": depth,
            "ticks": ticks,
            "depthMode": "estimated",
        }

    def _build_intraday_series(self, symbol: str) -> list[dict[str, Any]]:
        history = self._provider.get_history(symbol, period="1d", interval="5m", auto_adjust=False)
        if history.empty:
            return []

        history = history.tail(96).reset_index()
        time_column = "Datetime" if "Datetime" in history.columns else "Date"
        history[time_column] = pd.to_datetime(history[time_column], utc=True)
        cumulative_volume = 0.0
        cumulative_turnover = 0.0
        points: list[dict[str, Any]] = []

        for _, row in history.iterrows():
            price = float(row["Close"])
            volume = float(row.get("Volume", 0) or 0)
            cumulative_volume += volume
            cumulative_turnover += price * volume
            avg_price = cumulative_turnover / cumulative_volume if cumulative_volume else price
            timestamp = row[time_column]
            points.append(
                {
                    "time": self._chart_time(timestamp),
                    "label": timestamp.strftime("%H:%M"),
                    "price": round(price, 2),
                    "volume": int(volume),
                    "avgPrice": round(avg_price, 2),
                }
            )

        return points

    def _build_depth_ladder(self, symbol: str, quote: dict[str, Any]) -> dict[str, Any]:
        last_price = float(quote["price"])
        step = 0.01 if last_price < 1000 else 0.05
        base_size = max(int(float(quote.get("volume") or 0) / 200000), 8)

        bids = []
        asks = []
        running_bid = 0
        running_ask = 0
        for level in range(5):
            bid_qty = base_size * (level + 2) * 7
            ask_qty = base_size * (6 - level) * 5
            running_bid += bid_qty
            running_ask += ask_qty
            bids.append(
                {
                    "price": round(last_price - step * level, 2),
                    "quantity": bid_qty,
                    "total": running_bid,
                }
            )
            asks.append(
                {
                    "price": round(last_price + step * (level + 1), 2),
                    "quantity": ask_qty,
                    "total": running_ask,
                }
            )

        return {
            "symbol": symbol,
            "bids": bids,
            "asks": asks,
            "timestamp": _iso(datetime.now(UTC)),
        }

    def _build_tick_tape(self, symbol: str, intraday: list[dict[str, Any]]) -> list[dict[str, Any]]:
        recent_points = intraday[-20:]
        ticks: list[dict[str, Any]] = []
        previous_price: float | None = None
        for index, point in enumerate(reversed(recent_points)):
            price = float(point["price"])
            if previous_price is None:
                side = "BUY"
            elif price >= previous_price:
                side = "BUY"
            else:
                side = "SELL"
            ticks.append(
                {
                    "id": f"tick-{symbol.lower()}-{index}",
                    "symbol": symbol,
                    "price": round(price, 2),
                    "quantity": int(point.get("volume", 0) or 0),
                    "side": side,
                    "timestamp": datetime.fromtimestamp(int(point["time"]), tz=UTC).isoformat(),
                }
            )
            previous_price = price
        return ticks

    def _build_news_items(self, symbol: str) -> list[dict[str, Any]]:
        try:
            articles = self._provider.get_news(symbol, limit=8)
        except Exception:
            return []

        if not articles:
            return []

        positive_words = {
            "beat",
            "growth",
            "surge",
            "upgrade",
            "bull",
            "gain",
            "strong",
            "record",
            "上涨",
            "增长",
            "利好",
            "增持",
            "回购",
            "突破",
        }
        negative_words = {
            "miss",
            "fall",
            "downgrade",
            "risk",
            "probe",
            "weak",
            "drop",
            "loss",
            "下跌",
            "利空",
            "减持",
            "亏损",
            "调查",
            "警告",
        }
        news_items: list[dict[str, Any]] = []
        for index, article in enumerate(articles):
            title = str(article.get("title", "") or "")
            if not title.strip():
                continue
            summary = str(article.get("summary") or article.get("description") or "")
            title_lower = f"{title} {summary}".lower()
            score = 0.0
            for word in positive_words:
                if word in title_lower:
                    score += 0.2
            for word in negative_words:
                if word in title_lower:
                    score -= 0.2
            score = max(-1.0, min(1.0, score))
            sentiment = "neutral"
            if score > 0.15:
                sentiment = "positive"
            elif score < -0.15:
                sentiment = "negative"

            publish_time = article.get("timestamp") or article.get("providerPublishTime")
            if isinstance(publish_time, str) and publish_time.strip():
                timestamp = publish_time
            elif publish_time:
                timestamp = datetime.fromtimestamp(int(publish_time), tz=UTC).isoformat()
            else:
                timestamp = _iso(datetime.now(UTC))

            source = article.get("source") or article.get("publisher") or "Unknown"
            news_items.append(
                {
                    "id": str(article.get("id") or f"news-{symbol.lower()}-{index}"),
                    "title": title,
                    "summary": summary,
                    "source": source,
                    "url": article.get("url") or article.get("link"),
                    "sentiment": sentiment,
                    "sentimentScore": round(score, 2),
                    "relatedSymbols": article.get("relatedSymbols") or [symbol],
                    "timestamp": timestamp,
                }
            )
        return news_items

    def _build_chart_quote(
        self,
        symbol: str,
        latest_bar: dict[str, Any],
        ohlcv: list[dict[str, Any]],
        intraday: list[dict[str, Any]],
    ) -> dict[str, Any]:
        market_lookup = {
            str(market.get("symbol")): market for market in self._snapshot.get("markets", []) if isinstance(market, dict)
        }
        market = market_lookup.get(symbol, {})
        previous_close = float(market.get("previousClose") or 0) or float(ohlcv[-2]["close"] if len(ohlcv) > 1 else latest_bar["close"])
        change = float(latest_bar["close"]) - previous_close
        intraday_high = max((point["price"] for point in intraday), default=float(latest_bar["high"]))
        intraday_low = min((point["price"] for point in intraday), default=float(latest_bar["low"]))
        amplitude_base = intraday_low or previous_close or 1.0

        return {
            "symbol": symbol,
            "price": round(float(latest_bar["close"]), 2),
            "change": round(change, 2),
            "changePercent": round((change / previous_close) * 100, 2) if previous_close else 0.0,
            "open": round(float(latest_bar["open"]), 2),
            "high": round(float(latest_bar["high"]), 2),
            "low": round(float(latest_bar["low"]), 2),
            "previousClose": round(previous_close, 2),
            "volume": int(latest_bar["volume"]),
            "amplitude": round(((intraday_high - intraday_low) / amplitude_base) * 100, 2) if amplitude_base else 0.0,
            "high52w": market.get("high52w"),
            "low52w": market.get("low52w"),
            "pe": market.get("pe"),
            "pb": market.get("pb"),
            "marketCap": market.get("marketCap"),
        }

    def _calculate_chart_indicators(self, history: pd.DataFrame, time_column: str) -> dict[str, Any]:
        close = history["Close"].astype(float)
        high = history["High"].astype(float)
        low = history["Low"].astype(float)
        volume = history["Volume"].fillna(0).astype(float)
        times = [self._chart_time(value) for value in history[time_column]]

        def line_series(values: pd.Series) -> list[dict[str, Any]]:
            return [
                {"time": current_time, "value": cleaned}
                for current_time, cleaned in (
                    (time_value, self._clean_number(value))
                    for time_value, value in zip(times, values, strict=False)
                )
                if cleaned is not None
            ]

        ma5 = close.rolling(window=5).mean()
        ma10 = close.rolling(window=10).mean()
        ma20 = close.rolling(window=20).mean()
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        boll_mid = ma20
        boll_std = close.rolling(window=20).std()
        boll_upper = boll_mid + 2 * boll_std
        boll_lower = boll_mid - 2 * boll_std

        delta = close.diff()
        gain = delta.clip(lower=0).rolling(window=14).mean()
        loss = (-delta.clip(upper=0)).rolling(window=14).mean()
        rs = gain / loss.replace(0, pd.NA)
        rsi = 100 - (100 / (1 + rs))

        macd_line = ema12 - ema26
        macd_signal = macd_line.ewm(span=9, adjust=False).mean()
        macd_hist = (macd_line - macd_signal) * 2

        lowest_low = low.rolling(window=9).min()
        highest_high = high.rolling(window=9).max()
        rsv = ((close - lowest_low) / (highest_high - lowest_low).replace(0, pd.NA)) * 100
        k_value = rsv.fillna(50).ewm(com=2, adjust=False).mean()
        d_value = k_value.ewm(com=2, adjust=False).mean()
        j_value = 3 * k_value - 2 * d_value

        macd = [
            {
                "time": time_value,
                "macd": self._clean_number(macd_value),
                "signal": self._clean_number(signal_value),
                "histogram": self._clean_number(hist_value),
            }
            for time_value, macd_value, signal_value, hist_value in zip(
                times,
                macd_line,
                macd_signal,
                macd_hist,
                strict=False,
            )
            if self._clean_number(macd_value) is not None and self._clean_number(signal_value) is not None
        ]
        kdj = [
            {
                "time": time_value,
                "k": self._clean_number(k_item),
                "d": self._clean_number(d_item),
                "j": self._clean_number(j_item),
            }
            for time_value, k_item, d_item, j_item in zip(times, k_value, d_value, j_value, strict=False)
            if self._clean_number(k_item) is not None and self._clean_number(d_item) is not None
        ]

        return {
            "overlays": {
                "MA": {
                    "ma5": line_series(ma5),
                    "ma10": line_series(ma10),
                    "ma20": line_series(ma20),
                },
                "EMA": {
                    "ema12": line_series(ema12),
                    "ema26": line_series(ema26),
                },
                "BOLL": {
                    "upper": line_series(boll_upper),
                    "middle": line_series(boll_mid),
                    "lower": line_series(boll_lower),
                },
                "VOL": {
                    "volumeMa5": line_series(volume.rolling(window=5).mean()),
                    "volumeMa10": line_series(volume.rolling(window=10).mean()),
                },
            },
            "oscillators": {
                "RSI": line_series(rsi),
                "MACD": macd,
                "KDJ": kdj,
            },
        }

    def _build_positions(self, markets: list[dict[str, Any]]) -> tuple[list[PositionRecord], float]:
        market_lookup = {market["symbol"]: market for market in markets}
        managed_lookup = {
            position.symbol: position
            for position in self._executor.get_managed_positions()
            if position.status == "open"
        }
        book: dict[str, dict[str, Any]] = {}
        cash_balance = self.capital

        orders = sorted(
            self._executor._orders.values(),
            key=lambda order: order.filled_at or order.updated_at or order.created_at,
            reverse=False,
        )

        for order in orders:
            if order.status != OrderStatus.FILLED:
                continue

            fill_price = float(order.avg_fill_price or order.limit_price or 0)
            quantity = float(order.filled_quantity or order.quantity)
            symbol_book = book.setdefault(order.symbol, {"quantity": 0.0, "avg_price": 0.0})

            if order.side == "buy":
                if symbol_book["quantity"] >= 0:
                    total_cost = symbol_book["quantity"] * symbol_book["avg_price"] + quantity * fill_price
                    symbol_book["quantity"] += quantity
                    symbol_book["avg_price"] = total_cost / symbol_book["quantity"] if symbol_book["quantity"] else 0.0
                else:
                    short_qty = abs(symbol_book["quantity"])
                    if quantity < short_qty:
                        symbol_book["quantity"] += quantity
                    elif quantity == short_qty:
                        symbol_book["quantity"] = 0.0
                        symbol_book["avg_price"] = 0.0
                    else:
                        residual = quantity - short_qty
                        symbol_book["quantity"] = residual
                        symbol_book["avg_price"] = fill_price
                cash_balance -= quantity * fill_price + order.commission
            else:
                if symbol_book["quantity"] <= 0:
                    short_qty = abs(symbol_book["quantity"])
                    total_short_cost = short_qty * symbol_book["avg_price"] + quantity * fill_price
                    new_short_qty = short_qty + quantity
                    symbol_book["quantity"] = -new_short_qty
                    symbol_book["avg_price"] = total_short_cost / new_short_qty if new_short_qty else 0.0
                else:
                    if quantity < symbol_book["quantity"]:
                        symbol_book["quantity"] -= quantity
                    elif quantity == symbol_book["quantity"]:
                        symbol_book["quantity"] = 0.0
                        symbol_book["avg_price"] = 0.0
                    else:
                        residual = quantity - symbol_book["quantity"]
                        symbol_book["quantity"] = -residual
                        symbol_book["avg_price"] = fill_price
                cash_balance += quantity * fill_price - order.commission

        positions: list[PositionRecord] = []

        for symbol, payload in book.items():
            quantity = payload["quantity"]
            if quantity == 0 or symbol not in market_lookup:
                continue

            market = market_lookup[symbol]
            managed_position = managed_lookup.get(symbol)
            current_price = float(market["price"])
            exposure_qty = abs(quantity)
            market_value = exposure_qty * current_price
            avg_price = payload["avg_price"] or current_price
            pnl = (
                quantity * (current_price - avg_price)
                if quantity > 0
                else exposure_qty * (avg_price - current_price)
            )
            day_change = quantity * float(market["change"])
            positions.append(
                PositionRecord(
                    symbol=symbol,
                    quantity=quantity,
                    avg_price=avg_price,
                    market_value=market_value,
                    pnl=pnl,
                    pnl_percent=(
                        ((current_price - avg_price) / avg_price) * 100
                        if quantity > 0 and avg_price
                        else ((avg_price - current_price) / avg_price) * 100 if avg_price else 0.0
                    ),
                    day_change=day_change,
                    day_change_percent=float(market["changePercent"]),
                    name=market["name"],
                    sector=market.get("sector", "Unknown"),
                )
            )

        return positions, round(cash_balance, 2)

    def _build_portfolio(
        self,
        positions: list[PositionRecord],
        cash_balance: float,
        historical_data: list[dict[str, Any]],
    ) -> dict[str, Any]:
        invested_value = sum(position.market_value for position in positions)
        total_value = invested_value + cash_balance
        day_pnl = sum(position.day_change for position in positions)
        total_pnl = sum(position.pnl for position in positions)
        historical_values = [point["value"] for point in historical_data] or [total_value]
        peak = max(historical_values)
        current = historical_values[-1]
        max_drawdown = ((current - peak) / peak) * 100 if peak else 0.0

        position_payload = []
        for position in positions:
            weight = (position.market_value / total_value) * 100 if total_value else 0.0
            position_payload.append(
                {
                    "symbol": position.symbol,
                    "name": position.name,
                    "quantity": round(position.quantity, 4),
                    "avgPrice": round(position.avg_price, 2),
                    "currentPrice": round(position.market_value / abs(position.quantity), 2) if position.quantity else 0.0,
                    "pnl": round(position.pnl, 2),
                    "pnlPercent": round(position.pnl_percent, 2),
                    "marketValue": round(position.market_value, 2),
                    "weight": round(weight, 2),
                    "dayChange": round(position.day_change, 2),
                    "dayChangePercent": round(position.day_change_percent, 2),
                    "sector": position.sector,
                    **self._position_management_payload(position.symbol),
                }
            )

        return {
            "totalValue": round(total_value, 2),
            "cashBalance": round(cash_balance, 2),
            "investedValue": round(invested_value, 2),
            "dayPnl": round(day_pnl, 2),
            "dayPnlPercent": round((day_pnl / total_value) * 100, 2) if total_value else 0.0,
            "weekPnl": round(day_pnl * 3, 2),
            "weekPnlPercent": round((day_pnl * 3 / total_value) * 100, 2) if total_value else 0.0,
            "monthPnl": round(day_pnl * 8, 2),
            "monthPnlPercent": round((day_pnl * 8 / total_value) * 100, 2) if total_value else 0.0,
            "totalPnl": round(total_pnl, 2),
            "totalPnlPercent": round((total_pnl / max(total_value - total_pnl, 1)) * 100, 2) if total_pnl else 0.0,
            "sharpeRatio": 1.2 if historical_values else 0.0,
            "maxDrawdown": round(max_drawdown, 2),
            "winRate": 100.0 if positions else 0.0,
            "positions": position_payload,
        }

    def _build_paper_account(
        self,
        portfolio: dict[str, Any],
        signals: list[dict[str, Any]],
        trades: list[dict[str, Any]],
        risk: dict[str, Any],
    ) -> dict[str, Any]:
        risk_state = self._risk_manager.export_state()
        closed_trades = [
            trade for trade in risk_state.get("closed_trades", [])
            if isinstance(trade, dict)
        ]
        realized_pnl = round(sum(float(trade.get("pnl", 0.0) or 0.0) for trade in closed_trades), 2)
        unrealized_pnl = round(float(portfolio.get("totalPnl", 0.0) or 0.0), 2)
        pending_signals = len([
            signal for signal in signals
            if str(signal.get("status", "")).upper() == "PENDING"
        ])
        executed_trades = len([
            trade for trade in trades
            if str(trade.get("status", "")).upper() in {"FILLED", "PARTIAL"}
        ])

        return {
            "mode": "paper",
            "market": self.market,
            "strategy": self.strategy,
            "capital": round(float(self.capital), 2),
            "buyingPower": round(float(portfolio.get("cashBalance", self.capital) or self.capital), 2),
            "equity": round(float(portfolio.get("totalValue", self.capital) or self.capital), 2),
            "dayPnl": round(float(portfolio.get("dayPnl", 0.0) or 0.0), 2),
            "realizedPnl": realized_pnl,
            "unrealizedPnl": unrealized_pnl,
            "openPositions": int(len(portfolio.get("positions", []))),
            "pendingSignals": pending_signals,
            "executedTrades": executed_trades,
            "autoTradingEnabled": bool(self._paper_settings.get("autoTradingEnabled")),
            "lastAutoRunAt": self._paper_settings.get("lastAutoRunAt"),
            "lastResetAt": self._paper_settings.get("lastResetAt"),
            "tradingPaused": bool(risk.get("tradingPaused", False)),
        }

    async def _build_risk(
        self,
        positions: list[PositionRecord],
        historical_data: list[dict[str, Any]],
    ) -> dict[str, Any]:
        portfolio_risk = await self._risk_manager.execute("portfolio_risk")
        values = [point["value"] for point in historical_data]
        returns: list[float] = []
        for previous, current in zip(values, values[1:]):
            if previous:
                returns.append((current - previous) / previous)

        volatility = (sum(abs(ret) for ret in returns) / len(returns) * 100) if returns else 0.0
        concentration = (
            max((position.market_value for position in positions), default=0.0)
            / max(sum(position.market_value for position in positions), 1.0)
            * 10
        )

        return {
            "var95": round(sum(position.market_value for position in positions) * 0.028, 2),
            "var99": round(sum(position.market_value for position in positions) * 0.041, 2),
            "maxDrawdown": round(abs(min((point["value"] - max(values[: index + 1])) / max(values[: index + 1], default=1) * 100 for index, point in enumerate(historical_data))), 2) if historical_data else 0.0,
            "volatility": round(volatility, 2),
            "beta": 1.0,
            "concentrationRisk": round(concentration, 2),
            "liquidityRisk": 2.0,
            "overallRiskScore": round(float(portfolio_risk.get("risk_score", 0.0)) * 10, 1),
            "portfolioHeat": round(float(portfolio_risk.get("portfolio_heat", 0.0) or 0.0) * 100, 2),
            "consecutiveLosses": int(portfolio_risk.get("consecutive_losses", 0) or 0),
            "tradingPaused": bool(portfolio_risk.get("trading_paused", False)),
        }

    def _build_alerts(
        self,
        positions: list[PositionRecord],
        risk: dict[str, Any],
    ) -> list[dict[str, Any]]:
        alerts: list[dict[str, Any]] = []
        total_value = sum(position.market_value for position in positions)

        for position in positions:
            weight = position.market_value / total_value if total_value else 0.0
            if weight > 0.35:
                alerts.append(
                    {
                        "id": f"alert-concentration-{position.symbol.lower()}",
                        "type": "concentration",
                        "severity": "medium",
                        "message": f"{position.symbol} concentration is {weight * 100:.1f}% of invested capital",
                        "timestamp": _iso(datetime.now(UTC) - timedelta(minutes=3)),
                        "acknowledged": False,
                        "details": {"symbol": position.symbol, "weight": round(weight * 100, 2)},
                    }
                )

        if risk["overallRiskScore"] >= 6:
            alerts.append(
                {
                    "id": "alert-risk-overall",
                    "type": "volatility",
                    "severity": "high",
                    "message": f"Overall portfolio risk score is elevated at {risk['overallRiskScore']}/10",
                    "timestamp": _iso(datetime.now(UTC) - timedelta(minutes=1)),
                    "acknowledged": False,
                    "details": {"riskScore": risk["overallRiskScore"]},
                }
            )

        return alerts

    def _build_trades(self) -> list[dict[str, Any]]:
        trades: list[dict[str, Any]] = []
        for index, order in enumerate(
            sorted(self._executor._orders.values(), key=lambda item: item.filled_at or item.updated_at or item.created_at, reverse=True)
        ):
            if order.status != OrderStatus.FILLED:
                continue

            price = float(order.avg_fill_price or order.limit_price or 0)
            trades.append(
                {
                    "id": f"trade-{index + 1:03d}",
                    "symbol": order.symbol,
                    "side": order.side.upper(),
                    "quantity": round(float(order.filled_quantity or order.quantity), 4),
                    "price": round(price, 2),
                    "totalValue": round(price * float(order.filled_quantity or order.quantity), 2),
                    "status": order.status.value.upper(),
                    "timestamp": order.filled_at or order.updated_at or order.created_at,
                    "commission": round(order.commission, 2),
                    "slippage": round(order.slippage, 4),
                    "reason": str(order.metadata.get("source", "signal")),
                }
            )
        return trades

    def _position_management_payload(self, symbol: str) -> dict[str, Any]:
        managed_position = next(
            (
                position for position in self._executor.get_managed_positions()
                if position.symbol == symbol and position.status == "open"
            ),
            None,
        )
        if managed_position is None:
            return {}

        holding_minutes = 0
        try:
            holding_minutes = max(
                0,
                int((datetime.now(UTC) - datetime.fromisoformat(managed_position.opened_at)).total_seconds() // 60),
            )
        except ValueError:
            holding_minutes = 0

        return {
            "side": managed_position.side.upper(),
            "protectiveStop": round(managed_position.stop_loss, 2),
            "targetPrice": round(managed_position.target_price, 2),
            "strategy": managed_position.strategy,
            "trailingActive": managed_position.trailing_active,
            "partialExitDone": managed_position.partial_exit_done,
            "holdingMinutes": holding_minutes,
            "timeDecayMinutes": int(managed_position.metadata.get("time_decay_minutes", 0) or 0),
            "kellyFraction": round(float(managed_position.metadata.get("kelly_fraction", 0.0) or 0.0), 4),
        }

    def _build_agents(self, now: datetime, signal_count: int) -> list[dict[str, Any]]:
        tracked_symbols = self._tracked_symbols()
        return [
            {
                "id": "agent-researcher",
                "name": "Researcher",
                "role": "researcher",
                "status": "running",
                "lastActivity": _iso(now - timedelta(minutes=2)),
                "taskCount": len(tracked_symbols),
                "successRate": 95.0,
                "currentTask": "Refreshing market overview",
                "description": "Market research and data analysis",
            },
            {
                "id": "agent-strategist",
                "name": "Strategist",
                "role": "strategist",
                "status": "running",
                "lastActivity": _iso(now - timedelta(minutes=1)),
                "taskCount": signal_count,
                "successRate": 80.0,
                "currentTask": "Ranking trade opportunities",
                "description": "Strategy generation and signal creation",
            },
            {
                "id": "agent-risk",
                "name": "Risk Manager",
                "role": "risk_manager",
                "status": "running",
                "lastActivity": _iso(now - timedelta(seconds=30)),
                "taskCount": max(signal_count, 1),
                "successRate": 99.0,
                "currentTask": "Assessing portfolio risk",
                "description": "Risk assessment and position control",
            },
            {
                "id": "agent-executor",
                "name": "Executor",
                "role": "executor",
                "status": "idle" if signal_count == 0 else "running",
                "lastActivity": _iso(now - timedelta(minutes=5)),
                "taskCount": len(self._executor._orders),
                "successRate": 95.0,
                "currentTask": "Monitoring paper orders" if signal_count else None,
                "description": "Order execution and trade monitoring",
            },
        ]

    def _build_historical_data(self) -> list[dict[str, Any]]:
        end_date = date.today()
        start_date = end_date - timedelta(days=90)

        try:
            engine = BacktestEngine(
                strategy_name=self.strategy,
                start_date=start_date,
                end_date=end_date,
                initial_capital=self.capital,
                symbols=self.symbols[:3],
            )
            result = engine.run()
            if result.get("error"):
                raise RuntimeError(result["error"])

            equity_curve = result.get("equity_curve", [])
            if not equity_curve:
                raise RuntimeError("Empty equity curve")

            recent_curve = equity_curve[-30:]
            first_value = recent_curve[0]
            dates = [end_date - timedelta(days=len(recent_curve) - index - 1) for index in range(len(recent_curve))]
            return [
                {
                    "date": current_date.isoformat(),
                    "value": round(value, 2),
                    "benchmark": round(first_value * (1 + 0.0008 * index), 2),
                }
                for index, (current_date, value) in enumerate(zip(dates, recent_curve))
            ]
        except Exception:
            return self._fallback.historical_data()

    def _build_daily_history(self, positions: list[PositionRecord]) -> list[dict[str, Any]]:
        if not positions:
            return self._fallback.daily_history()

        series_by_symbol: list[list[tuple[str, float]]] = []

        for position in positions[:3]:
            try:
                history = self._provider.get_history(position.symbol, period="1d", interval="30m", auto_adjust=False)
                if history.empty:
                    continue

                history = history.reset_index()
                time_column = "Datetime" if "Datetime" in history.columns else "Date"
                open_price = float(history.iloc[0]["Close"])
                symbol_series: list[tuple[str, float]] = []
                for _, row in history.iterrows():
                    timestamp = pd.to_datetime(row[time_column])
                    price = float(row["Close"])
                    pnl = (price - open_price) * position.quantity
                    symbol_series.append((timestamp.strftime("%H:%M"), pnl))
                if symbol_series:
                    series_by_symbol.append(symbol_series)
            except Exception:
                continue

        if not series_by_symbol:
            return self._fallback.daily_history()

        merged: dict[str, float] = {}
        for series in series_by_symbol:
            for timestamp, pnl in series:
                merged[timestamp] = merged.get(timestamp, 0.0) + pnl

        return [{"time": timestamp, "pnl": round(pnl, 2)} for timestamp, pnl in sorted(merged.items())]

    def _snapshot_should_refresh(self) -> bool:
        if self._last_refresh is None:
            return True
        if not self.symbols:
            return False
        return not bool(self._snapshot.get("markets"))

    def _expected_return_pct(self, signal: dict[str, Any]) -> float:
        entry = float(signal.get("entry_price") or 0)
        target = float(signal.get("target_price") or entry)
        if not entry:
            return 0.0
        direction = str(signal.get("signal_type", "hold")).lower()
        if direction == SignalType.SELL.value:
            return round(((entry - target) / entry) * 100, 2)
        return round(((target - entry) / entry) * 100, 2)

    def _suggested_quantity(self, signal: dict[str, Any]) -> float:
        entry = float(signal.get("entry_price") or 0)
        position_size_pct = float(signal.get("position_size_pct") or 0)
        if not entry or not position_size_pct:
            return 0.0
        return round((self.capital * position_size_pct) / entry, 4)

    def _append_log(
        self,
        agent_id: str,
        agent_name: str,
        level: str,
        message: str,
        details: dict[str, Any] | None = None,
        timestamp: datetime | None = None,
    ) -> None:
        self._logs.appendleft(
            {
                "id": f"log-{datetime.now(UTC).timestamp():.6f}",
                "agentId": agent_id,
                "agentName": agent_name,
                "timestamp": _iso(timestamp or datetime.now(UTC)),
                "level": level,
                "message": message,
                "details": details or {},
            }
        )

    async def _update_signal_status(self, signal_id: str, target_status: str) -> dict[str, Any]:
        await self._ensure_fresh()

        async with self._lock:
            signal = next(
                (item for item in self._snapshot.get("signals", []) if item.get("id") == signal_id),
                None,
            )
            if signal is None:
                raise KeyError(f"Signal {signal_id} was not found")

            current_status = str(signal.get("status", "PENDING"))
            if current_status == target_status:
                return signal

            if current_status in {"EXECUTED", "REJECTED", "CANCELLED"}:
                raise ValueError(f"Signal in status {current_status} cannot be updated")

            now = datetime.now(UTC)
            await self._apply_signal_status(signal, target_status=target_status, now=now, source="manual")

            await self._rebuild_snapshot_views(now=now)
            self._persist_state()
            updated_signal = next(
                (item for item in self._snapshot.get("signals", []) if item.get("id") == signal_id),
                signal,
            )
            return updated_signal

    async def _apply_signal_status(
        self,
        signal: dict[str, Any],
        *,
        target_status: str,
        now: datetime,
        source: str,
    ) -> dict[str, Any]:
        signal_id = str(signal.get("id") or self._signal_id(signal))
        current_status = str(signal.get("status", "PENDING"))
        next_status = target_status
        execution_details: dict[str, Any] | None = None

        if target_status == "APPROVED" and str(signal.get("type")) in {"BUY", "SELL"}:
            execution = await self._executor.execute(
                "place_order",
                signal=self._executor_signal_payload(signal),
                quantity=float(signal.get("quantity") or 0.0) or None,
            )
            execution_details = execution
            execution_status = execution.get("execution", {}).get("status")

            if execution.get("success") and execution_status == OrderStatus.FILLED.value:
                next_status = "EXECUTED"
                order = execution.get("order", {})
                filled_quantity = float(order.get("filled_quantity") or order.get("quantity") or 0.0)
                fill_price = float(
                    order.get("avg_fill_price")
                    or order.get("limit_price")
                    or signal.get("entryPrice")
                    or 0.0
                )
                position_value = filled_quantity * fill_price
                if str(order.get("side", "")).lower() == "buy":
                    self._risk_manager.update_position(str(signal.get("symbol")), position_value)
                else:
                    self._risk_manager.update_position(str(signal.get("symbol")), 0.0)

                self._append_log(
                    agent_id="agent-executor",
                    agent_name="Executor",
                    level="success",
                    message=f"Executed {signal['symbol']} {signal['type']} order at ${fill_price:.2f}",
                    details=execution,
                    timestamp=now,
                )
            else:
                next_status = "APPROVED"

        signal["status"] = next_status
        signal["timestamp"] = _iso(now)
        self._signal_overrides[signal_id] = {
            "status": next_status,
            "updatedAt": _iso(now),
        }

        if target_status == "REJECTED":
            message = f"Rejected signal for {signal['symbol']}"
            level = "warning"
        elif source == "auto":
            message = f"Auto-routed strategy signal for {signal['symbol']}"
            level = "success"
        else:
            message = f"Approved signal for {signal['symbol']}"
            level = "success"

        self._append_log(
            agent_id="agent-system",
            agent_name="System",
            level=level,
            message=message,
            details={
                "signalId": signal_id,
                "previousStatus": current_status,
                "status": next_status,
                "execution": execution_details,
                "source": source,
            },
            timestamp=now,
        )
        return signal

    async def _auto_execute_pending_signals(self, signals: list[dict[str, Any]], now: datetime) -> None:
        if not self._paper_settings.get("autoTradingEnabled"):
            return

        max_auto = max(0, int(self._paper_settings.get("maxAutoSignalsPerRefresh", 0) or 0))
        if max_auto <= 0:
            return

        auto_candidates = [
            signal for signal in signals
            if str(signal.get("status", "")).upper() == "PENDING"
            and str(signal.get("type", "")).upper() in {"BUY", "SELL"}
            and not bool(signal.get("tradingPaused", False))
        ][:max_auto]

        if not auto_candidates:
            return

        for signal in auto_candidates:
            await self._apply_signal_status(signal, target_status="APPROVED", now=now, source="auto")
        self._paper_settings["lastAutoRunAt"] = _iso(now)

    async def _rebuild_snapshot_views(self, now: datetime | None = None) -> None:
        current_time = now or datetime.now(UTC)
        markets = list(self._snapshot.get("markets", []))
        signals = list(self._snapshot.get("signals", []))
        positions, cash_balance = self._build_positions(markets)
        historical_data = list(self._snapshot.get("historicalData", [])) or await asyncio.to_thread(
            self._build_historical_data
        )
        risk = await self._build_risk(positions, historical_data)
        alerts = self._build_alerts(positions, risk)
        daily_history = await asyncio.to_thread(self._build_daily_history, positions)
        portfolio = self._build_portfolio(positions, cash_balance, historical_data)
        trades = self._build_trades()
        agents = self._build_agents(current_time, len(signals))
        paper_account = self._build_paper_account(portfolio, signals, trades, risk)

        self._snapshot.update(
            {
                "portfolio": portfolio,
                "signals": signals,
                "agents": agents,
                "trades": trades,
                "risk": risk,
                "alerts": alerts,
                "logs": list(self._logs),
                "historicalData": historical_data,
                "dailyHistory": daily_history,
                "paperAccount": paper_account,
            }
        )

    @staticmethod
    def _signal_id(signal: dict[str, Any]) -> str:
        fingerprint = "|".join(
            [
                str(signal.get("symbol", "")),
                str(signal.get("signal_type", signal.get("type", ""))).upper(),
                f"{float(signal.get('entry_price', signal.get('entryPrice', 0.0)) or 0.0):.4f}",
                f"{float(signal.get('target_price', signal.get('targetPrice', 0.0)) or 0.0):.4f}",
                f"{float(signal.get('stop_loss', signal.get('stopLoss', 0.0)) or 0.0):.4f}",
            ]
        )
        digest = hashlib.sha1(fingerprint.encode("utf-8")).hexdigest()[:10]
        return f"sig-{digest}"

    @staticmethod
    def _executor_signal_payload(signal: dict[str, Any]) -> dict[str, Any]:
        signal_type = str(signal.get("type", "HOLD")).upper()
        signal_enum = SignalType.BUY if signal_type == "BUY" else SignalType.SELL if signal_type == "SELL" else SignalType.HOLD
        entry_price = float(signal.get("entryPrice", 0.0) or 0.0)
        stop_loss, target_price = _normalize_brackets(
            signal_enum,
            entry_price,
            float(signal.get("stopLoss", 0.0) or 0.0) or None,
            float(signal.get("targetPrice", 0.0) or 0.0) or None,
            default_stop_loss_pct=StrategistAgent.DEFAULT_STOP_LOSS_PCT,
            risk_reward_ratio=StrategistAgent.MIN_RISK_REWARD_RATIO,
        )
        return {
            "symbol": signal.get("symbol"),
            "signal_type": signal_type.lower(),
            "confidence": float(signal.get("confidence", 0.0) or 0.0),
            "entry_price": entry_price,
            "target_price": float(target_price or 0.0),
            "stop_loss": float(stop_loss or 0.0),
            "rationale": signal.get("rationale", ""),
            "timeframe": "medium",
            "risk_reward_ratio": 2.0,
            "position_size_pct": 0.0,
            "metadata": {**dict(signal.get("metadata", {})), "source": "dashboard-approval"},
        }

    def _set_context(self) -> None:
        context = AgentContext(
            symbols=self._tracked_symbols(),
            strategy=self.strategy,
            mode="paper",
            capital=self.capital,
            metadata={"source": "dashboard-runtime", "market": self.market},
        )
        for agent in (self._researcher, self._strategist, self._risk_manager, self._executor):
            agent.set_context(context)

    def _tracked_symbols(self) -> list[str]:
        tracked: list[str] = []
        for symbol in self.symbols:
            normalized = str(symbol).strip().upper()
            if normalized and normalized not in tracked:
                tracked.append(normalized)
        for item in self._watchlist:
            normalized = str(item.get("symbol", "")).strip().upper()
            if normalized and normalized not in tracked:
                tracked.append(normalized)
        for position in self._executor.get_managed_positions():
            if position.status != "open":
                continue
            normalized = str(position.symbol).strip().upper()
            if normalized and normalized not in tracked:
                tracked.append(normalized)
        return tracked or list(self.symbols)

    def _ensure_symbol_in_universe(self, symbol: str) -> None:
        normalized = symbol.strip().upper()
        if not normalized:
            return
        if normalized not in self.symbols:
            self.symbols.append(normalized)
        self._set_context()

    def _ensure_market_entry(self, symbol: str) -> None:
        normalized = symbol.strip().upper()
        markets = self._snapshot.get("markets", [])
        if not isinstance(markets, list):
            self._snapshot["markets"] = []
            markets = self._snapshot["markets"]
        if any(str(item.get("symbol", "")).upper() == normalized for item in markets if isinstance(item, dict)):
            return

        try:
            chart = self._build_chart_payload(normalized, "1d")
        except Exception:
            return

        quote = dict(chart.get("quote", {}))
        markets.append(
            {
                "symbol": normalized,
                "name": str(chart.get("name") or normalized),
                "price": round(float(quote.get("price") or 0.0), 2),
                "change": round(float(quote.get("change") or 0.0), 2),
                "changePercent": round(float(quote.get("changePercent") or 0.0), 2),
                "volume": int(float(quote.get("volume") or 0.0)),
                "high24h": round(float(quote.get("high") or quote.get("price") or 0.0), 2),
                "low24h": round(float(quote.get("low") or quote.get("price") or 0.0), 2),
                "open": round(float(quote.get("open") or quote.get("price") or 0.0), 2),
                "previousClose": round(float(quote.get("previousClose") or quote.get("price") or 0.0), 2),
                "sector": "Watchlist",
            }
        )

    def _state_key(self, name: str) -> str:
        return f"{self._state_key_prefix}{name}"

    def _shared_state_key(self, name: str) -> str:
        return f"{self._shared_state_key_prefix}{name}"

    def _normalize_watchlist_symbol(self, raw_symbol: str) -> str:
        raw = raw_symbol.strip()
        if not raw:
            return ""

        market_lookup = {
            str(market.get("symbol", "")).upper(): market for market in self._snapshot.get("markets", [])
            if isinstance(market, dict)
        }
        name_lookup = {
            str(market.get("name", "")).strip().lower(): str(market.get("symbol", "")).upper()
            for market in self._snapshot.get("markets", [])
            if isinstance(market, dict)
        }

        direct = raw.upper()
        if direct in market_lookup:
            return direct
        if raw.lower() in name_lookup:
            return name_lookup[raw.lower()]

        if self.market == "A":
            digits = re.sub(r"\D", "", raw)
            if len(digits) == 6:
                suffix = ".SS" if digits.startswith(("5", "6", "9")) else ".SZ"
                return f"{digits}{suffix}"
        return direct

    def _resolve_symbol_name(self, symbol: str) -> str:
        for market in self._snapshot.get("markets", []):
            if isinstance(market, dict) and str(market.get("symbol", "")).upper() == symbol:
                return str(market.get("name") or symbol)

        if symbol in A_SHARE_NAMES:
            return A_SHARE_NAMES[symbol]

        try:
            info = self._provider.get_info(symbol)
        except Exception:
            return symbol

        return str(
            info.get("shortName")
            or info.get("longName")
            or info.get("displayName")
            or symbol
        )

    def _validate_watchlist_symbol(self, symbol: str) -> bool:
        try:
            history = self._provider.get_history(symbol, period="5d", interval="1d")
            if history is not None and not history.empty:
                return True
        except Exception:
            pass

        try:
            info = self._provider.get_info(symbol)
        except Exception:
            return False

        return bool(info.get("shortName") or info.get("longName") or info.get("displayName"))

    def _persist_state(self) -> None:
        self._state_store.save_many(
            {
                self._state_key("snapshot"): self._snapshot,
                self._state_key("logs"): list(self._logs),
                self._state_key("executor_state"): self._executor.export_state(),
                self._state_key("risk_state"): self._risk_manager.export_state(),
                self._state_key("signal_overrides"): self._signal_overrides,
                self._state_key("paper_settings"): self._paper_settings,
                self._shared_state_key("watchlist"): self._watchlist,
                self._state_key("last_refresh"): self._last_refresh.isoformat() if self._last_refresh else None,
            }
        )

    def _restore_state(self) -> None:
        snapshot = self._state_store.load(self._state_key("snapshot"))
        if isinstance(snapshot, dict):
            self._snapshot = snapshot

        logs = self._state_store.load(self._state_key("logs"), [])
        if isinstance(logs, list):
            self._logs = deque(logs, maxlen=100)

        executor_state = self._state_store.load(self._state_key("executor_state"), {})
        if isinstance(executor_state, dict):
            self._executor.restore_state(executor_state)

        risk_state = self._state_store.load(self._state_key("risk_state"), {})
        if isinstance(risk_state, dict):
            self._risk_manager.restore_state(risk_state)

        signal_overrides = self._state_store.load(self._state_key("signal_overrides"), {})
        if isinstance(signal_overrides, dict):
            self._signal_overrides = signal_overrides

        paper_settings = self._state_store.load(self._state_key("paper_settings"), {})
        if isinstance(paper_settings, dict):
            self._paper_settings = {
                **self._paper_settings,
                **paper_settings,
            }
            self.capital = float(self._paper_settings.get("capital", self.capital) or self.capital)
            self._set_context()

        watchlist = self._state_store.load(self._shared_state_key("watchlist"))
        if isinstance(watchlist, list):
            self._watchlist = [item for item in watchlist if isinstance(item, dict)]
        else:
            self._watchlist = [
                {
                    "symbol": symbol,
                    "name": A_SHARE_NAMES.get(symbol, symbol),
                    "addedAt": _iso(datetime.now(UTC)),
                }
                for symbol in self.symbols[: min(3, len(self.symbols))]
            ]

        last_refresh = self._state_store.load(self._state_key("last_refresh"))
        if isinstance(last_refresh, str):
            try:
                self._last_refresh = datetime.fromisoformat(last_refresh)
            except ValueError:
                self._last_refresh = None
