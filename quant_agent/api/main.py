"""FastAPI app powering the React dashboard."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from quant_agent.api.runtime_service import DashboardRuntimeService


app = FastAPI(title="QuantAgent API", version="0.1.0")
service = DashboardRuntimeService()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "timestamp": datetime.now(UTC).isoformat()}


@app.get("/api/portfolio")
async def get_portfolio() -> dict:
    return await service.get_portfolio()


@app.get("/api/markets")
async def get_markets() -> list[dict]:
    return await service.get_markets()


@app.get("/api/signals")
async def get_signals() -> list[dict]:
    return await service.get_signals()


@app.post("/api/signals/{signal_id}/approve")
async def approve_signal(signal_id: str) -> dict:
    try:
        return await service.approve_signal(signal_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/signals/{signal_id}/reject")
async def reject_signal(signal_id: str) -> dict:
    try:
        return await service.reject_signal(signal_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/agents")
async def get_agents() -> list[dict]:
    return await service.get_agents()


@app.get("/api/trades")
async def get_trades() -> list[dict]:
    return await service.get_trades()


@app.get("/api/risk")
async def get_risk() -> dict:
    return await service.get_risk()


@app.get("/api/alerts")
async def get_alerts() -> list[dict]:
    return await service.get_alerts()


@app.get("/api/logs")
async def get_logs() -> list[dict]:
    return await service.get_logs()


@app.get("/api/historical")
async def get_historical() -> list[dict]:
    return await service.get_historical()


@app.get("/api/daily-history")
async def get_daily_history() -> list[dict]:
    return await service.get_daily_history()


@app.post("/api/refresh")
async def refresh_snapshot() -> dict[str, str]:
    await service.get_snapshot(force_refresh=True)
    return {"status": "ok", "timestamp": datetime.now(UTC).isoformat()}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()

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
