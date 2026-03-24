"""Tools available to agents."""

from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Any

import pandas as pd

from quant_agent.core.memory import AgentMemory, MemoryType
from quant_agent.data.providers import get_market_data_provider


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
            provider = get_market_data_provider("A" if _is_a_stock(symbol) else "US")
            df = provider.get_history(symbol, period=period, interval=interval, auto_adjust=False)
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
            provider = get_market_data_provider("A" if _is_a_stock(symbol) else "US")
            info = provider.get_info(symbol)
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
        if df.empty:
            return {}

        df = df.copy()
        for column in ("Open", "High", "Low", "Close", "Volume"):
            if column in df.columns:
                df[column] = pd.to_numeric(df[column], errors="coerce")

        results = {}

        for indicator in indicators:
            if indicator == "sma_20":
                results["sma_20"] = df["Close"].rolling(window=20).mean().tolist()
            elif indicator == "sma_50":
                results["sma_50"] = df["Close"].rolling(window=50).mean().tolist()
            elif indicator == "ema_9":
                results["ema_9"] = df["Close"].ewm(span=9, adjust=False).mean().tolist()
            elif indicator == "ema_21":
                results["ema_21"] = df["Close"].ewm(span=21, adjust=False).mean().tolist()
            elif indicator == "ema_12":
                results["ema_12"] = df["Close"].ewm(span=12, adjust=False).mean().tolist()
            elif indicator == "ema_26":
                results["ema_26"] = df["Close"].ewm(span=26, adjust=False).mean().tolist()
            elif indicator == "rsi":
                results["rsi"] = self._calculate_rsi(df["Close"]).tolist()
            elif indicator == "macd":
                ema_12 = df["Close"].ewm(span=12, adjust=False).mean()
                ema_26 = df["Close"].ewm(span=26, adjust=False).mean()
                results["macd"] = (ema_12 - ema_26).tolist()
                results["macd_signal"] = (ema_12 - ema_26).ewm(span=9, adjust=False).mean().tolist()
            elif indicator == "atr_14":
                results["atr_14"] = self._calculate_atr(df).tolist()
            elif indicator == "adx_14":
                results["adx_14"] = self._calculate_adx(df).tolist()
            elif indicator == "vwap":
                results["vwap"] = self._calculate_vwap(df).tolist()
            elif indicator == "avg_volume":
                results["avg_volume"] = df["Volume"].rolling(window=20).mean().tolist()
            elif indicator == "body_pct":
                results["body_pct"] = (
                    ((df["Close"] - df["Open"]).abs() / df["Open"].replace(0, pd.NA)) * 100
                ).fillna(0).tolist()

        return results

    def _calculate_rsi(self, prices: pd.Series, period: int = 14) -> pd.Series:
        """Calculate RSI indicator."""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        return 100 - (100 / (1 + rs))

    def _calculate_atr(self, df: pd.DataFrame, period: int = 14) -> pd.Series:
        prev_close = df["Close"].shift(1)
        true_range = pd.concat(
            [
                df["High"] - df["Low"],
                (df["High"] - prev_close).abs(),
                (df["Low"] - prev_close).abs(),
            ],
            axis=1,
        ).max(axis=1)
        return true_range.rolling(window=period).mean()

    def _calculate_adx(self, df: pd.DataFrame, period: int = 14) -> pd.Series:
        high_diff = df["High"].diff()
        low_diff = -df["Low"].diff()

        plus_dm = high_diff.where((high_diff > low_diff) & (high_diff > 0), 0.0)
        minus_dm = low_diff.where((low_diff > high_diff) & (low_diff > 0), 0.0)

        atr = self._calculate_atr(df, period).replace(0, pd.NA)
        plus_di = 100 * (plus_dm.rolling(window=period).mean() / atr)
        minus_di = 100 * (minus_dm.rolling(window=period).mean() / atr)
        dx = ((plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, pd.NA)) * 100
        return dx.rolling(window=period).mean().fillna(0)

    def _calculate_vwap(self, df: pd.DataFrame) -> pd.Series:
        typical_price = (df["High"] + df["Low"] + df["Close"]) / 3
        cumulative_value = (typical_price * df["Volume"]).cumsum()
        cumulative_volume = df["Volume"].cumsum().replace(0, pd.NA)
        return (cumulative_value / cumulative_volume).ffill().fillna(df["Close"])


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
            provider = get_market_data_provider("A" if _is_a_stock(symbol) else "US")
            news = provider.get_news(symbol, limit=10)
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
                    "publisher": article.get("source") or article.get("publisher"),
                    "link": article.get("url") or article.get("link"),
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
