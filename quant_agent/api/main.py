"""FastAPI app powering the React dashboard."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from fastapi import Body, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
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


def validate_strategy(strategy: str) -> str:
    normalized = strategy.strip().lower()
    if normalized not in {"fortress", "vwap_pullback", "orb"}:
        raise HTTPException(status_code=422, detail="strategy must be one of: fortress, vwap_pullback, orb")
    return normalized


def get_service(market: str = "US", strategy: str = "fortress") -> DashboardRuntimeService:
    service_key = f"{market}:{strategy}"
    if service_key not in services:
        symbols = US_SYMBOLS if market == "US" else A_SYMBOLS
        services[service_key] = DashboardRuntimeService(market=market, symbols=symbols, strategy=strategy)
    return services[service_key]


def validate_market(market: str) -> str:
    normalized = market.upper()
    if normalized not in {"A", "US"}:
        raise HTTPException(status_code=422, detail="market must be one of: A, US")
    return normalized


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "timestamp": datetime.now(UTC).isoformat()}


@app.get("/api/portfolio")
async def get_portfolio(
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> dict:
    return await get_service(validate_market(market), validate_strategy(strategy)).get_portfolio()


@app.get("/api/markets")
async def get_markets(
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> list[dict]:
    return await get_service(validate_market(market), validate_strategy(strategy)).get_markets()


@app.get("/api/signals")
async def get_signals(
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> list[dict]:
    return await get_service(validate_market(market), validate_strategy(strategy)).get_signals()


@app.post("/api/signals/{signal_id}/approve")
async def approve_signal(
    signal_id: str,
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> dict:
    try:
        return await get_service(validate_market(market), validate_strategy(strategy)).approve_signal(signal_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/signals/{signal_id}/reject")
async def reject_signal(
    signal_id: str,
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> dict:
    try:
        return await get_service(validate_market(market), validate_strategy(strategy)).reject_signal(signal_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/agents")
async def get_agents(
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> list[dict]:
    return await get_service(validate_market(market), validate_strategy(strategy)).get_agents()


@app.get("/api/trades")
async def get_trades(
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> list[dict]:
    return await get_service(validate_market(market), validate_strategy(strategy)).get_trades()


@app.get("/api/risk")
async def get_risk(
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> dict:
    return await get_service(validate_market(market), validate_strategy(strategy)).get_risk()


@app.get("/api/alerts")
async def get_alerts(
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> list[dict]:
    return await get_service(validate_market(market), validate_strategy(strategy)).get_alerts()


@app.get("/api/logs")
async def get_logs(
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> list[dict]:
    return await get_service(validate_market(market), validate_strategy(strategy)).get_logs()


@app.get("/api/historical")
async def get_historical(
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> list[dict]:
    return await get_service(validate_market(market), validate_strategy(strategy)).get_historical()


@app.get("/api/daily-history")
async def get_daily_history(
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> list[dict]:
    return await get_service(validate_market(market), validate_strategy(strategy)).get_daily_history()


@app.get("/api/chart")
async def get_chart(
    symbol: str,
    interval: str = Query("1d", pattern="^(1m|5m|15m|30m|60m|1d|1w|1M)$"),
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> dict:
    return await get_service(validate_market(market), validate_strategy(strategy)).get_chart(symbol=symbol, interval=interval)


@app.get("/api/news")
async def get_news(
    symbol: str,
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> list[dict]:
    return await get_service(validate_market(market), validate_strategy(strategy)).get_news(symbol=symbol)


@app.get("/api/watchlist")
async def get_watchlist(
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> list[dict]:
    return await get_service(validate_market(market), validate_strategy(strategy)).get_watchlist()


@app.get("/api/paper-account")
async def get_paper_account(
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> dict:
    return await get_service(validate_market(market), validate_strategy(strategy)).get_paper_account()


@app.post("/api/paper-account/settings")
async def update_paper_account_settings(
    payload: dict = Body(default={}),
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> dict:
    auto_trading_enabled = payload.get("autoTradingEnabled")
    if auto_trading_enabled is not None and not isinstance(auto_trading_enabled, bool):
        raise HTTPException(status_code=422, detail="autoTradingEnabled must be a boolean")
    return await get_service(
        validate_market(market),
        validate_strategy(strategy),
    ).update_paper_settings(auto_trading_enabled=auto_trading_enabled)


@app.post("/api/paper-account/reset")
async def reset_paper_account(
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> dict:
    return await get_service(validate_market(market), validate_strategy(strategy)).reset_paper_account()


@app.post("/api/watchlist/{symbol}")
async def add_watchlist_symbol(
    symbol: str,
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> list[dict]:
    try:
        return await get_service(validate_market(market), validate_strategy(strategy)).add_watchlist_symbol(symbol)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.delete("/api/watchlist/{symbol}")
async def remove_watchlist_symbol(
    symbol: str,
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> list[dict]:
    return await get_service(validate_market(market), validate_strategy(strategy)).remove_watchlist_symbol(symbol)


@app.post("/api/refresh")
async def refresh_snapshot(
    market: str = Query("US", pattern="^(A|US)$"),
    strategy: str = Query("fortress"),
) -> dict[str, str]:
    normalized_market = validate_market(market)
    normalized_strategy = validate_strategy(strategy)
    await get_service(normalized_market, normalized_strategy).get_snapshot(force_refresh=True)
    return {
        "status": "ok",
        "timestamp": datetime.now(UTC).isoformat(),
        "market": normalized_market,
        "strategy": normalized_strategy,
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    market = validate_market(websocket.query_params.get("market", "US"))
    strategy = validate_strategy(websocket.query_params.get("strategy", "fortress"))
    service = get_service(market, strategy)

    try:
        while True:
            snapshot = await service.get_snapshot(force_refresh=True)
            for message_type in ("portfolio", "markets", "signals", "agents", "trades", "risk", "alerts", "logs", "paperAccount"):
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
