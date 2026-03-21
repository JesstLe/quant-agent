"""Tools available to agents."""

from abc import ABC, abstractmethod
from typing import Any
import yfinance as yf
import pandas as pd

from quant_agent.core.memory import AgentMemory, MemoryType


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
        period: str = "1mo",
        interval: str = "1d",
    ) -> dict[str, Any]:
        """Fetch market data from Yahoo Finance."""
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)

        if df.empty:
            return {"error": f"No data found for {symbol}"}

        return {
            "symbol": symbol,
            "period": period,
            "interval": interval,
            "data": df.reset_index().to_dict(orient="records"),
            "columns": list(df.columns),
        }


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
        ticker = yf.Ticker(symbol)
        info = ticker.info

        return {
            "symbol": symbol,
            "name": info.get("longName", ""),
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
        ticker = yf.Ticker(symbol)
        news = ticker.news

        if not news:
            return {"symbol": symbol, "sentiment": "neutral", "score": 0.5, "articles": []}

        # Simple sentiment analysis based on news titles
        # In production, use proper NLP models
        positive_words = ["buy", "upgrade", "bullish", "gain", "rise", "positive", "growth"]
        negative_words = ["sell", "downgrade", "bearish", "loss", "fall", "negative", "decline"]

        total_score = 0
        articles = []

        for article in news[:10]:
            title = article.get("title", "").lower()
            score = 0
            for word in positive_words:
                if word in title:
                    score += 1
            for word in negative_words:
                if word in title:
                    score -= 1
            total_score += score
            articles.append({
                "title": article.get("title"),
                "publisher": article.get("publisher"),
                "link": article.get("link"),
                "score": score,
            })

        avg_score = total_score / len(news) if news else 0
        normalized_score = (avg_score + 2) / 4  # Normalize to 0-1
        normalized_score = max(0, min(1, normalized_score))

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
