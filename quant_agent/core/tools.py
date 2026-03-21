"""Tools available to agents."""

from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Any

try:
    import akshare as ak
except ImportError:  # pragma: no cover - optional dependency
    ak = None
import pandas as pd
import yfinance as yf

from quant_agent.core.memory import AgentMemory, MemoryType


def _is_a_stock(symbol: str) -> bool:
    """判断是否为A股股票代码"""
    return symbol.endswith('.SS') or symbol.endswith('.SZ') or symbol.isdigit()


def _convert_a_stock_code(symbol: str) -> str:
    """转换A股代码为akshare需要的格式"""
    if symbol.endswith('.SS'):
        return symbol.replace('.SS', '')
    elif symbol.endswith('.SZ'):
        return symbol.replace('.SZ', '')
    else:
        return symbol


def _to_serializable_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    normalized = df.copy()
    for column in normalized.columns:
        if pd.api.types.is_datetime64_any_dtype(normalized[column]):
            normalized[column] = normalized[column].astype(str)
    return normalized.to_dict(orient="records")


class Tool(ABC):
    """Base class for agent tools."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Tool name."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Tool description."""
        pass

    @abstractmethod
    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        """Execute the tool."""
        pass


class GetMarketDataTool(Tool):
    """Tool to fetch market data."""

    @property
    def name(self) -> str:
        return "get_market_data"

    @property
    def description(self) -> str:
        return "Fetch historical market data for a symbol"

    async def execute(
        self,
        symbol: str,
        period: str = "3mo",
        interval: str = "1d",
    ) -> dict[str, Any]:
        """Fetch market data from Yahoo Finance for both A-shares and US equities."""
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=period, interval=interval, auto_adjust=False)
            if df.empty:
                return {"error": f"No data found for {symbol}"}

            df = df.reset_index()
            date_column = "Datetime" if "Datetime" in df.columns else "Date"
            if date_column in df.columns:
                df[date_column] = pd.to_datetime(df[date_column]).astype(str)
                if date_column != "Date":
                    df = df.rename(columns={date_column: "Date"})

            return {
                "symbol": symbol,
                "period": period,
                "interval": interval,
                "data": _to_serializable_records(df),
                "columns": list(df.columns),
            }
        except Exception as e:
            return {"error": f"Failed to fetch data for {symbol}: {str(e)}"}


class GetStockInfoTool(Tool):
    """Tool to get stock information."""

    @property
    def name(self) -> str:
        return "get_stock_info"

    @property
    def description(self) -> str:
        return "Get detailed information about a stock"

    async def execute(self, symbol: str) -> dict[str, Any]:
        """Get stock information."""
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info or {}
            name = info.get("longName") or info.get("shortName") or symbol

            return {
                "symbol": symbol,
                "name": name,
                "sector": info.get("sector", ""),
                "industry": info.get("industry", ""),
                "market_cap": info.get("marketCap", 0),
                "pe_ratio": info.get("trailingPE", 0),
                "forward_pe": info.get("forwardPE", 0),
                "dividend_yield": info.get("dividendYield", 0),
                "beta": info.get("beta", 0),
                "52_week_high": info.get("fiftyTwoWeekHigh", 0),
                "52_week_low": info.get("fiftyTwoWeekLow", 0),
                "avg_volume": info.get("averageVolume", 0),
            }
        except Exception as e:
            return {"symbol": symbol, "error": str(e)}


class CalculateIndicatorsTool(Tool):
    """Tool to calculate technical indicators."""

    @property
    def name(self) -> str:
        return "calculate_indicators"

    @property
    def description(self) -> str:
        return "Calculate technical indicators for market data"

    async def execute(
        self,
        data: list[dict[str, Any]],
        indicators: list[str],
    ) -> dict[str, Any]:
        """Calculate technical indicators."""
        df = pd.DataFrame(data)

        results = {}

        for indicator in indicators:
            if indicator == "sma_20":
                results["sma_20"] = df["Close"].rolling(window=20).mean().tolist()
            elif indicator == "sma_50":
                results["sma_50"] = df["Close"].rolling(window=50).mean().tolist()
            elif indicator == "ema_12":
                results["ema_12"] = df["Close"].ewm(span=12).mean().tolist()
            elif indicator == "ema_26":
                results["ema_26"] = df["Close"].ewm(span=26).mean().tolist()
            elif indicator == "rsi":
                results["rsi"] = self._calculate_rsi(df["Close"]).tolist()
            elif indicator == "macd":
                ema_12 = df["Close"].ewm(span=12).mean()
                ema_26 = df["Close"].ewm(span=26).mean()
                results["macd"] = (ema_12 - ema_26).tolist()
                results["macd_signal"] = (ema_12 - ema_26).ewm(span=9).mean().tolist()

        return results

    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> pd.Series:
        """Calculate RSI indicator."""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - (100 / (1 + rs))


class AnalyzeSentimentTool(Tool):
    """Tool to analyze market sentiment."""

    @property
    def name(self) -> str:
        return "analyze_sentiment"

    @property
    def description(self) -> str:
        return "Analyze market sentiment from news and data"

    async def execute(self, symbol: str) -> dict[str, Any]:
        """Analyze sentiment for a symbol."""
        try:
            ticker = yf.Ticker(symbol)
            news = ticker.news
        except Exception as e:
            return {"symbol": symbol, "sentiment": "neutral", "score": 0.5, "articles": [], "error": str(e)}

        if not news:
            return {"symbol": symbol, "sentiment": "neutral", "score": 0.5, "articles": []}

        positive_words = ["buy", "upgrade", "bullish", "gain", "rise", "positive", "growth", "beat", "strong"]
        negative_words = ["sell", "downgrade", "bearish", "loss", "fall", "negative", "decline", "miss", "weak"]

        total_score = 0
        articles = []

        for article in news[:10]:
            title = str(article.get("title", "")).lower()
            score = 0
            for word in positive_words:
                if word in title:
                    score += 1
            for word in negative_words:
                if word in title:
                    score -= 1
            total_score += score
            articles.append(
                {
                    "title": article.get("title"),
                    "publisher": article.get("publisher"),
                    "link": article.get("link"),
                    "score": score,
                }
            )

        avg_score = total_score / max(len(articles), 1)
        normalized_score = max(0, min(1, (avg_score + 2) / 4))

        if normalized_score > 0.6:
            sentiment = "bullish"
        elif normalized_score < 0.4:
            sentiment = "bearish"
        else:
            sentiment = "neutral"

        return {
            "symbol": symbol,
            "sentiment": sentiment,
            "score": normalized_score,
            "articles": articles[:5],
        }


class ToolRegistry:
    """Registry of available tools."""

    def __init__(self):
        self._tools: dict[str, Tool] = {}
        self._register_default_tools()

    def _register_default_tools(self):
        """Register default tools."""
        default_tools = [
            GetMarketDataTool(),
            GetStockInfoTool(),
            CalculateIndicatorsTool(),
            AnalyzeSentimentTool(),
        ]
        for tool in default_tools:
            self._tools[tool.name] = tool

    def register(self, tool: Tool):
        """Register a tool."""
        self._tools[tool.name] = tool

    def get(self, name: str) -> Tool | None:
        """Get a tool by name."""
        return self._tools.get(name)

    def list_tools(self) -> list[dict[str, str]]:
        """List all available tools."""
        return [{"name": t.name, "description": t.description} for t in self._tools.values()]

    async def execute(self, name: str, **kwargs: Any) -> dict[str, Any]:
        """Execute a tool by name."""
        tool = self.get(name)
        if not tool:
            return {"error": f"Tool not found: {name}"}
        return await tool.execute(**kwargs)
