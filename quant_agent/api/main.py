"""FastAPI app powering the React dashboard."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from quant_agent.api.runtime_service import DashboardRuntimeService


app = FastAPI(title="QuantAgent API", version="0.1.0")

US_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "NVDA", "AMZN", "TSLA"]
A_SYMBOLS = ["600519.SS", "000858.SZ", "601318.SS", "600036.SS", "000333.SZ", "002594.SZ"]

services: dict[str, DashboardRuntimeService] = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_service(market: str = "US") -> DashboardRuntimeService:
    if market not in services:
        symbols = US_SYMBOLS if market == "US" else A_SYMBOLS
        services[market] = DashboardRuntimeService(symbols=symbols)
    return services[market]


def validate_market(market: str) -> str:
    normalized = market.upper()
    if normalized not in {"A", "US"}:
        raise HTTPException(status_code=422, detail="market must be one of: A, US")
    return normalized


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "timestamp": datetime.now(UTC).isoformat()}


@app.get("/api/portfolio")
async def get_portfolio(market: str = Query("US", pattern="^(A|US)$")) -> dict:
    return await get_service(validate_market(market)).get_portfolio()


@app.get("/api/markets")
async def get_markets(market: str = Query("US", pattern="^(A|US)$")) -> list[dict]:
    return await get_service(validate_market(market)).get_markets()


@app.get("/api/signals")
async def get_signals(market: str = Query("US", pattern="^(A|US)$")) -> list[dict]:
    return await get_service(validate_market(market)).get_signals()


@app.post("/api/signals/{signal_id}/approve")
async def approve_signal(signal_id: str, market: str = Query("US", pattern="^(A|US)$")) -> dict:
    try:
        return await get_service(validate_market(market)).approve_signal(signal_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/signals/{signal_id}/reject")
async def reject_signal(signal_id: str, market: str = Query("US", pattern="^(A|US)$")) -> dict:
    try:
        return await get_service(validate_market(market)).reject_signal(signal_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/agents")
async def get_agents(market: str = Query("US", pattern="^(A|US)$")) -> list[dict]:
    return await get_service(validate_market(market)).get_agents()


@app.get("/api/trades")
async def get_trades(market: str = Query("US", pattern="^(A|US)$")) -> list[dict]:
    return await get_service(validate_market(market)).get_trades()


@app.get("/api/risk")
async def get_risk(market: str = Query("US", pattern="^(A|US)$")) -> dict:
    return await get_service(validate_market(market)).get_risk()


@app.get("/api/alerts")
async def get_alerts(market: str = Query("US", pattern="^(A|US)$")) -> list[dict]:
    return await get_service(validate_market(market)).get_alerts()


@app.get("/api/logs")
async def get_logs(market: str = Query("US", pattern="^(A|US)$")) -> list[dict]:
    return await get_service(validate_market(market)).get_logs()


@app.get("/api/historical")
async def get_historical(market: str = Query("US", pattern="^(A|US)$")) -> list[dict]:
    return await get_service(validate_market(market)).get_historical()


@app.get("/api/daily-history")
async def get_daily_history(market: str = Query("US", pattern="^(A|US)$")) -> list[dict]:
    return await get_service(validate_market(market)).get_daily_history()


@app.post("/api/refresh")
async def refresh_snapshot(market: str = Query("US", pattern="^(A|US)$")) -> dict[str, str]:
    await get_service(validate_market(market)).get_snapshot(force_refresh=True)
    return {"status": "ok", "timestamp": datetime.now(UTC).isoformat(), "market": validate_market(market)}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    market = validate_market(websocket.query_params.get("market", "US"))
    service = get_service(market)

    try:
        while True:
            snapshot = await service.get_snapshot(force_refresh=True)
            for message_type in ("portfolio", "markets", "signals", "agents", "trades", "risk", "alerts", "logs"):
                await websocket.send_json(
                    {
                        "type": message_type,
                        "payload": snapshot[message_type],
                        "timestamp": datetime.now(UTC).isoformat(),
                    }
                )
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        return
