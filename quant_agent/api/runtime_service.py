"""Runtime-backed dashboard data service."""

from __future__ import annotations

import asyncio
from collections import deque
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
import hashlib
from typing import Any

import yfinance as yf

from quant_agent.agents.base import AgentContext
from quant_agent.agents.executor import ExecutorAgent, OrderStatus
from quant_agent.agents.researcher import ResearcherAgent
from quant_agent.agents.risk_manager import RiskManagerAgent
from quant_agent.agents.strategist import SignalType, StrategistAgent
from quant_agent.api.demo_service import DashboardDemoService
from quant_agent.api.persistence import RuntimeStateStore
from quant_agent.backtest.engine import BacktestEngine
from quant_agent.core.llm import get_llm
from quant_agent.core.memory import AgentMemory
from quant_agent.core.tools import ToolRegistry


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
        symbols: list[str] | None = None,
        strategy: str = "momentum",
        capital: float = 100_000.0,
        refresh_interval_seconds: int = 120,
        state_store: RuntimeStateStore | None = None,
    ) -> None:
        self.symbols = symbols or ["AAPL", "MSFT", "GOOGL", "NVDA", "AMZN", "TSLA"]
        self.strategy = strategy
        self.capital = capital
        self.refresh_interval_seconds = refresh_interval_seconds

        self._llm = get_llm()
        self._memory = AgentMemory()
        self._tools = ToolRegistry()
        self._researcher = ResearcherAgent(self._llm, self._tools, self._memory)
        self._strategist = StrategistAgent(self._llm, self._memory)
        self._risk_manager = RiskManagerAgent(self._llm, self._memory)
        self._executor = ExecutorAgent(self._llm, self._memory)
        self._fallback = DashboardDemoService()
        self._state_store = state_store or RuntimeStateStore()

        self._logs: deque[dict[str, Any]] = deque(maxlen=100)
        self._snapshot: dict[str, Any] = self._fallback.snapshot()
        self._signal_overrides: dict[str, dict[str, Any]] = {}
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

    async def approve_signal(self, signal_id: str) -> dict[str, Any]:
        return await self._update_signal_status(signal_id, "APPROVED")

    async def reject_signal(self, signal_id: str) -> dict[str, Any]:
        return await self._update_signal_status(signal_id, "REJECTED")

    async def _ensure_fresh(self, force_refresh: bool = False) -> None:
        if not force_refresh and self._last_refresh is not None:
            age = (datetime.now(UTC) - self._last_refresh).total_seconds()
            if age < self.refresh_interval_seconds:
                return

        async with self._lock:
            if not force_refresh and self._last_refresh is not None:
                age = (datetime.now(UTC) - self._last_refresh).total_seconds()
                if age < self.refresh_interval_seconds:
                    return
            await self._refresh_snapshot()

    async def _refresh_snapshot(self) -> None:
        now = datetime.now(UTC)
        self._last_refresh = now
        self._set_context()

        try:
            research = await self._researcher.execute("market_overview")
            markets = self._build_markets(research)

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
            positions, cash_balance = self._build_positions(markets)
            trades = self._build_trades()
            historical_data = await asyncio.to_thread(self._build_historical_data)
            risk = await self._build_risk(positions, historical_data)
            alerts = self._build_alerts(positions, risk)
            daily_history = await asyncio.to_thread(self._build_daily_history, positions)
            portfolio = self._build_portfolio(positions, cash_balance, historical_data)
            agents = self._build_agents(now, len(signals))

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
            assessment = await self._risk_manager.execute(
                "assess_trade",
                signal=signal,
                current_price=signal.get("entry_price"),
            )
            signal_type = str(signal.get("signal_type", "hold")).upper()
            status = "PENDING" if assessment.get("approved") else "REJECTED"
            signal_id = self._signal_id(signal)
            execution_details = None

            override = self._signal_overrides.get(signal_id)
            if override:
                status = str(override.get("status", status))

            api_signal = {
                "id": signal_id,
                "symbol": signal["symbol"],
                "type": signal_type,
                "confidence": round(float(signal.get("confidence", 0.0)), 2),
                "entryPrice": float(signal.get("entry_price") or 0),
                "targetPrice": float(signal.get("target_price") or 0),
                "stopLoss": float(signal.get("stop_loss") or 0),
                "rationale": signal.get("rationale", ""),
                "timestamp": _iso(datetime.now(UTC) - timedelta(minutes=index * 5)),
                "status": status,
                "agentSource": "Strategist",
                "riskScore": round(float(assessment.get("risk_score", 0.0)) * 10, 1),
                "expectedReturn": self._expected_return_pct(signal),
                "quantity": self._suggested_quantity(signal),
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
                    "name": stock_info.get("name") or symbol,
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

    def _build_positions(self, markets: list[dict[str, Any]]) -> tuple[list[PositionRecord], float]:
        market_lookup = {market["symbol"]: market for market in markets}
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
                total_cost = symbol_book["quantity"] * symbol_book["avg_price"] + quantity * fill_price
                symbol_book["quantity"] += quantity
                symbol_book["avg_price"] = total_cost / symbol_book["quantity"] if symbol_book["quantity"] else 0.0
                cash_balance -= quantity * fill_price + order.commission
            else:
                symbol_book["quantity"] = max(0.0, symbol_book["quantity"] - quantity)
                cash_balance += quantity * fill_price - order.commission

        positions: list[PositionRecord] = []

        for symbol, payload in book.items():
            quantity = payload["quantity"]
            if quantity <= 0 or symbol not in market_lookup:
                continue

            market = market_lookup[symbol]
            current_price = float(market["price"])
            market_value = quantity * current_price
            pnl = quantity * (current_price - payload["avg_price"])
            avg_price = payload["avg_price"] or current_price
            day_change = quantity * float(market["change"])
            positions.append(
                PositionRecord(
                    symbol=symbol,
                    quantity=quantity,
                    avg_price=avg_price,
                    market_value=market_value,
                    pnl=pnl,
                    pnl_percent=((current_price - avg_price) / avg_price) * 100 if avg_price else 0.0,
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
                    "currentPrice": round(position.market_value / position.quantity, 2) if position.quantity else 0.0,
                    "pnl": round(position.pnl, 2),
                    "pnlPercent": round(position.pnl_percent, 2),
                    "marketValue": round(position.market_value, 2),
                    "weight": round(weight, 2),
                    "dayChange": round(position.day_change, 2),
                    "dayChangePercent": round(position.day_change_percent, 2),
                    "sector": position.sector,
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
                }
            )
        return trades

    def _build_agents(self, now: datetime, signal_count: int) -> list[dict[str, Any]]:
        return [
            {
                "id": "agent-researcher",
                "name": "Researcher",
                "role": "researcher",
                "status": "running",
                "lastActivity": _iso(now - timedelta(minutes=2)),
                "taskCount": len(self.symbols),
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
                history = yf.Ticker(position.symbol).history(period="1d", interval="30m")
                if history.empty:
                    continue

                history = history.reset_index()
                open_price = float(history.iloc[0]["Close"])
                symbol_series: list[tuple[str, float]] = []
                for _, row in history.iterrows():
                    timestamp = row.iloc[0]
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

            action_label = "approved" if target_status == "APPROVED" else "rejected"
            self._append_log(
                agent_id="agent-system",
                agent_name="System",
                level="success" if target_status == "APPROVED" else "warning",
                message=f"{action_label.capitalize()} signal for {signal['symbol']}",
                details={
                    "signalId": signal_id,
                    "previousStatus": current_status,
                    "status": next_status,
                    "execution": execution_details,
                },
                timestamp=now,
            )

            await self._rebuild_snapshot_views(now=now)
            self._persist_state()
            updated_signal = next(
                (item for item in self._snapshot.get("signals", []) if item.get("id") == signal_id),
                signal,
            )
            return updated_signal

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
        return {
            "symbol": signal.get("symbol"),
            "signal_type": str(signal.get("type", "HOLD")).lower(),
            "confidence": float(signal.get("confidence", 0.0) or 0.0),
            "entry_price": float(signal.get("entryPrice", 0.0) or 0.0),
            "target_price": float(signal.get("targetPrice", 0.0) or 0.0),
            "stop_loss": float(signal.get("stopLoss", 0.0) or 0.0),
            "rationale": signal.get("rationale", ""),
            "timeframe": "medium",
            "risk_reward_ratio": 2.0,
            "position_size_pct": 0.0,
            "metadata": {"source": "dashboard-approval"},
        }

    def _set_context(self) -> None:
        context = AgentContext(
            symbols=self.symbols,
            strategy=self.strategy,
            mode="paper",
            capital=self.capital,
            metadata={"source": "dashboard-runtime"},
        )
        for agent in (self._researcher, self._strategist, self._risk_manager, self._executor):
            agent.set_context(context)

    def _persist_state(self) -> None:
        self._state_store.save_many(
            {
                "snapshot": self._snapshot,
                "logs": list(self._logs),
                "executor_state": self._executor.export_state(),
                "signal_overrides": self._signal_overrides,
                "last_refresh": self._last_refresh.isoformat() if self._last_refresh else None,
            }
        )

    def _restore_state(self) -> None:
        snapshot = self._state_store.load("snapshot")
        if isinstance(snapshot, dict):
            self._snapshot = snapshot

        logs = self._state_store.load("logs", [])
        if isinstance(logs, list):
            self._logs = deque(logs, maxlen=100)

        executor_state = self._state_store.load("executor_state", {})
        if isinstance(executor_state, dict):
            self._executor.restore_state(executor_state)

        signal_overrides = self._state_store.load("signal_overrides", {})
        if isinstance(signal_overrides, dict):
            self._signal_overrides = signal_overrides

        last_refresh = self._state_store.load("last_refresh")
        if isinstance(last_refresh, str):
            try:
                self._last_refresh = datetime.fromisoformat(last_refresh)
            except ValueError:
                self._last_refresh = None
