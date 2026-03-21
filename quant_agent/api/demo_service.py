"""Synthetic dashboard data for local development."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import math
from typing import Any


def _iso(dt: datetime) -> str:
    return dt.astimezone(UTC).isoformat()


@dataclass
class MarketSnapshot:
    symbol: str
    name: str
    base_price: float
    volume: int
    sector: str


class DashboardDemoService:
    """Provides stable, synthetic data for the React dashboard."""

    def __init__(self) -> None:
        self._markets: list[MarketSnapshot] = [
            MarketSnapshot("AAPL", "Apple Inc.", 178.52, 52340000, "Technology"),
            MarketSnapshot("MSFT", "Microsoft Corp.", 378.91, 21340000, "Technology"),
            MarketSnapshot("GOOGL", "Alphabet Inc.", 141.80, 18920000, "Technology"),
            MarketSnapshot("NVDA", "NVIDIA Corp.", 875.35, 42150000, "Technology"),
            MarketSnapshot("TSLA", "Tesla Inc.", 245.67, 89230000, "Consumer Cyclical"),
            MarketSnapshot("AMZN", "Amazon.com Inc.", 178.25, 34560000, "Consumer Cyclical"),
        ]
        self._started_at = datetime.now(UTC)

    def markets(self) -> list[dict[str, Any]]:
        elapsed = self._elapsed_minutes()
        payload: list[dict[str, Any]] = []

        for index, market in enumerate(self._markets):
            drift = math.sin((elapsed + index * 3) / 8) * (market.base_price * 0.01)
            price = round(market.base_price + drift, 2)
            previous_close = round(market.base_price, 2)
            change = round(price - previous_close, 2)
            low = round(min(price, previous_close) * 0.992, 2)
            high = round(max(price, previous_close) * 1.008, 2)

            payload.append(
                {
                    "symbol": market.symbol,
                    "name": market.name,
                    "price": price,
                    "change": change,
                    "changePercent": round((change / previous_close) * 100, 2),
                    "volume": market.volume,
                    "high24h": high,
                    "low24h": low,
                    "open": previous_close,
                    "previousClose": previous_close,
                }
            )

        return payload

    def portfolio(self) -> dict[str, Any]:
        markets = {item["symbol"]: item for item in self.markets()}
        positions = [
            {"symbol": "AAPL", "name": "Apple Inc.", "quantity": 150, "avgPrice": 165.30, "sector": "Technology"},
            {"symbol": "MSFT", "name": "Microsoft Corp.", "quantity": 80, "avgPrice": 355.00, "sector": "Technology"},
            {"symbol": "NVDA", "name": "NVIDIA Corp.", "quantity": 25, "avgPrice": 780.00, "sector": "Technology"},
            {"symbol": "GOOGL", "name": "Alphabet Inc.", "quantity": 100, "avgPrice": 138.50, "sector": "Technology"},
            {"symbol": "AMZN", "name": "Amazon.com Inc.", "quantity": 40, "avgPrice": 172.00, "sector": "Consumer Cyclical"},
        ]

        enriched_positions: list[dict[str, Any]] = []
        invested_value = 0.0
        day_pnl = 0.0
        total_pnl = 0.0

        for position in positions:
            market = markets[position["symbol"]]
            current_price = market["price"]
            market_value = round(position["quantity"] * current_price, 2)
            pnl = round((current_price - position["avgPrice"]) * position["quantity"], 2)
            pnl_percent = round(((current_price - position["avgPrice"]) / position["avgPrice"]) * 100, 2)
            daily_pnl_value = round(position["quantity"] * market["change"], 2)

            invested_value += market_value
            day_pnl += daily_pnl_value
            total_pnl += pnl

            enriched_positions.append(
                {
                    **position,
                    "currentPrice": current_price,
                    "pnl": pnl,
                    "pnlPercent": pnl_percent,
                    "marketValue": market_value,
                    "weight": 0.0,
                    "dayChange": daily_pnl_value,
                    "dayChangePercent": market["changePercent"],
                }
            )

        cash_balance = round(100000.0 - invested_value, 2)
        total_value = round(invested_value + cash_balance, 2)

        for position in enriched_positions:
            position["weight"] = round((position["marketValue"] / total_value) * 100, 2)

        week_pnl = round(day_pnl * 2.9, 2)
        month_pnl = round(day_pnl * 7.6, 2)

        return {
            "totalValue": total_value,
            "cashBalance": cash_balance,
            "investedValue": round(invested_value, 2),
            "dayPnl": round(day_pnl, 2),
            "dayPnlPercent": round((day_pnl / total_value) * 100, 2),
            "weekPnl": week_pnl,
            "weekPnlPercent": round((week_pnl / total_value) * 100, 2),
            "monthPnl": month_pnl,
            "monthPnlPercent": round((month_pnl / total_value) * 100, 2),
            "totalPnl": round(total_pnl, 2),
            "totalPnlPercent": round((total_pnl / (total_value - total_pnl)) * 100, 2),
            "sharpeRatio": 1.72,
            "maxDrawdown": -3.18,
            "winRate": 68.5,
            "positions": enriched_positions,
        }

    def signals(self) -> list[dict[str, Any]]:
        now = datetime.now(UTC)
        return [
            {
                "id": "sig-001",
                "symbol": "NVDA",
                "type": "BUY",
                "confidence": 0.87,
                "entryPrice": 875.35,
                "targetPrice": 950.00,
                "stopLoss": 830.00,
                "rationale": "Momentum remains strong and the risk-reward profile is favorable.",
                "timestamp": _iso(now - timedelta(minutes=5)),
                "status": "PENDING",
                "agentSource": "Strategist",
                "riskScore": 3.2,
                "expectedReturn": 8.54,
                "quantity": 15,
            },
            {
                "id": "sig-002",
                "symbol": "TSLA",
                "type": "SELL",
                "confidence": 0.72,
                "entryPrice": 245.67,
                "targetPrice": 220.00,
                "stopLoss": 265.00,
                "rationale": "Short-term downside pressure remains elevated after recent weakness.",
                "timestamp": _iso(now - timedelta(minutes=15)),
                "status": "APPROVED",
                "agentSource": "Strategist",
                "riskScore": 4.5,
                "expectedReturn": -10.46,
                "quantity": 50,
            },
            {
                "id": "sig-003",
                "symbol": "MSFT",
                "type": "BUY",
                "confidence": 0.91,
                "entryPrice": 378.91,
                "targetPrice": 420.00,
                "stopLoss": 360.00,
                "rationale": "Cloud growth and trend strength support an upside continuation setup.",
                "timestamp": _iso(now - timedelta(minutes=30)),
                "status": "EXECUTED",
                "agentSource": "Strategist",
                "riskScore": 2.1,
                "expectedReturn": 10.85,
                "quantity": 25,
            },
        ]

    def agents(self) -> list[dict[str, Any]]:
        now = datetime.now(UTC)
        return [
            {
                "id": "agent-researcher",
                "name": "Researcher",
                "role": "researcher",
                "status": "running",
                "lastActivity": _iso(now - timedelta(minutes=2)),
                "taskCount": 247,
                "successRate": 94.3,
                "currentTask": "Analyzing earnings and market breadth",
                "description": "Market research and data analysis",
            },
            {
                "id": "agent-strategist",
                "name": "Strategist",
                "role": "strategist",
                "status": "running",
                "lastActivity": _iso(now - timedelta(seconds=30)),
                "taskCount": 182,
                "successRate": 71.4,
                "currentTask": "Ranking current signal candidates",
                "description": "Strategy generation and signal creation",
            },
            {
                "id": "agent-risk",
                "name": "Risk Manager",
                "role": "risk_manager",
                "status": "running",
                "lastActivity": _iso(now - timedelta(minutes=5)),
                "taskCount": 312,
                "successRate": 99.7,
                "currentTask": "Monitoring concentration and VaR",
                "description": "Risk assessment and position control",
            },
            {
                "id": "agent-executor",
                "name": "Executor",
                "role": "executor",
                "status": "idle",
                "lastActivity": _iso(now - timedelta(minutes=12)),
                "taskCount": 89,
                "successRate": 97.8,
                "description": "Order execution and trade monitoring",
            },
        ]

    def trades(self) -> list[dict[str, Any]]:
        now = datetime.now(UTC)
        return [
            {
                "id": "trade-001",
                "symbol": "MSFT",
                "side": "BUY",
                "quantity": 25,
                "price": 378.91,
                "totalValue": 9472.75,
                "status": "FILLED",
                "timestamp": _iso(now - timedelta(minutes=5)),
                "commission": 4.99,
                "slippage": 0.02,
                "signalId": "sig-003",
            },
            {
                "id": "trade-002",
                "symbol": "AMZN",
                "side": "BUY",
                "quantity": 30,
                "price": 178.25,
                "totalValue": 5347.50,
                "status": "FILLED",
                "timestamp": _iso(now - timedelta(minutes=45)),
                "commission": 4.99,
                "slippage": 0.01,
                "signalId": "sig-005",
            },
        ]

    def risk(self) -> dict[str, Any]:
        return {
            "var95": 2847.52,
            "var99": 4123.18,
            "maxDrawdown": 3.24,
            "volatility": 18.7,
            "beta": 1.12,
            "concentrationRisk": 8.2,
            "liquidityRisk": 2.1,
            "overallRiskScore": 4.5,
        }

    def alerts(self) -> list[dict[str, Any]]:
        now = datetime.now(UTC)
        return [
            {
                "id": "alert-001",
                "type": "concentration",
                "severity": "medium",
                "message": "Technology sector exposure remains above the preferred threshold.",
                "timestamp": _iso(now - timedelta(minutes=10)),
                "acknowledged": False,
                "details": {"current": 82.4, "threshold": 80.0},
            },
            {
                "id": "alert-002",
                "type": "drawdown",
                "severity": "low",
                "message": "Portfolio drawdown is within tolerance but worth monitoring.",
                "timestamp": _iso(now - timedelta(hours=2)),
                "acknowledged": True,
                "details": {"drawdown": -2.1},
            },
        ]

    def logs(self) -> list[dict[str, Any]]:
        now = datetime.now(UTC)
        return [
            {
                "id": "log-001",
                "agentId": "agent-strategist",
                "agentName": "Strategist",
                "timestamp": _iso(now - timedelta(seconds=30)),
                "level": "success",
                "message": "Generated BUY signal for NVDA with 87% confidence",
                "details": {"symbol": "NVDA", "type": "BUY"},
            },
            {
                "id": "log-002",
                "agentId": "agent-risk",
                "agentName": "Risk Manager",
                "timestamp": _iso(now - timedelta(minutes=1)),
                "level": "info",
                "message": "Portfolio VaR (95%) calculated at $2,847",
                "details": {"var95": 2847.52},
            },
            {
                "id": "log-003",
                "agentId": "agent-executor",
                "agentName": "Executor",
                "timestamp": _iso(now - timedelta(minutes=5)),
                "level": "success",
                "message": "Filled MSFT order: 25 shares @ $378.91",
                "details": {"symbol": "MSFT", "quantity": 25},
            },
        ]

    def historical_data(self) -> list[dict[str, Any]]:
        today = datetime.now(UTC).date()
        points: list[dict[str, Any]] = []

        for offset in range(30):
            idx = 29 - offset
            day = today - timedelta(days=idx)
            points.append(
                {
                    "date": day.isoformat(),
                    "value": round(95000 + (offset * 185) + math.sin(offset * 0.45) * 780, 2),
                    "benchmark": round(95000 + (offset * 120) + math.sin(offset * 0.3) * 420, 2),
                }
            )

        return points

    def daily_history(self) -> list[dict[str, Any]]:
        return [
            {"time": "09:30", "pnl": 0},
            {"time": "10:00", "pnl": 245},
            {"time": "10:30", "pnl": -120},
            {"time": "11:00", "pnl": 380},
            {"time": "11:30", "pnl": 520},
            {"time": "12:00", "pnl": 410},
            {"time": "13:00", "pnl": 450},
            {"time": "14:00", "pnl": 780},
            {"time": "15:00", "pnl": 1050},
            {"time": "15:30", "pnl": 1164},
        ]

    def snapshot(self) -> dict[str, Any]:
        return {
            "portfolio": self.portfolio(),
            "markets": self.markets(),
            "signals": self.signals(),
            "agents": self.agents(),
            "trades": self.trades(),
            "risk": self.risk(),
            "alerts": self.alerts(),
            "logs": self.logs(),
            "historicalData": self.historical_data(),
            "dailyHistory": self.daily_history(),
        }

    def _elapsed_minutes(self) -> float:
        return (datetime.now(UTC) - self._started_at).total_seconds() / 60

