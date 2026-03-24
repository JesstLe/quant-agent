"""Researcher Agent - Market research and data analysis."""

from typing import Any

from quant_agent.agents.base import AgentRole, BaseAgent
from quant_agent.core.llm import LLMProvider
from quant_agent.core.memory import AgentMemory, MemoryType
from quant_agent.core.tools import ToolRegistry


class ResearcherAgent(BaseAgent):
    """
    Researcher Agent responsibilities:
    - Fetch and analyze market data
    - Identify trends and patterns
    - Analyze news and sentiment
    - Generate research reports
    """

    def __init__(self, llm: LLMProvider, tools: ToolRegistry, memory: AgentMemory | None = None):
        super().__init__(AgentRole.RESEARCHER, llm, memory)
        self.tools = tools

    @property
    def system_prompt(self) -> str:
        return """You are a Researcher Agent specializing in financial market analysis.

Your responsibilities:
1. Fetch and analyze market data for assigned symbols
2. Calculate technical indicators and identify patterns
3. Analyze news sentiment and market trends
4. Generate comprehensive research reports

Guidelines:
- Always base analysis on data, not speculation
- Consider multiple timeframes (short, medium, long term)
- Flag any unusual market conditions or anomalies
- Provide clear, actionable insights

Output format:
- Use structured JSON for data
- Include confidence levels for predictions
- Cite data sources and timestamps"""

    async def execute(self, task: str, **kwargs: Any) -> dict[str, Any]:
        """Execute a research task."""
        if task == "analyze_symbol":
            return await self._analyze_symbol(kwargs.get("symbol"))
        elif task == "market_overview":
            return await self._market_overview()
        elif task == "sentiment_analysis":
            return await self._sentiment_analysis(kwargs.get("symbol"))
        else:
            return {"error": f"Unknown task: {task}"}

    async def _analyze_symbol(self, symbol: str) -> dict[str, Any]:
        """Perform comprehensive analysis of a symbol."""
        # Fetch market data
        market_data = await self.tools.execute("get_market_data", symbol=symbol, period="3mo")
        intraday_market_data = await self.tools.execute(
            "get_market_data",
            symbol=symbol,
            period="5d",
            interval="15m",
        )

        # Get stock info
        stock_info = await self.tools.execute("get_stock_info", symbol=symbol)

        # Calculate indicators
        if market_data.get("data"):
            indicators = await self.tools.execute(
                "calculate_indicators",
                data=market_data["data"],
                indicators=[
                    "sma_20",
                    "sma_50",
                    "ema_9",
                    "ema_21",
                    "rsi",
                    "macd",
                    "atr_14",
                    "adx_14",
                    "vwap",
                    "avg_volume",
                    "body_pct",
                ],
            )
        else:
            indicators = {}

        if intraday_market_data.get("data"):
            intraday_indicators = await self.tools.execute(
                "calculate_indicators",
                data=intraday_market_data["data"],
                indicators=[
                    "ema_9",
                    "ema_21",
                    "rsi",
                    "macd",
                    "atr_14",
                    "adx_14",
                    "vwap",
                    "avg_volume",
                    "body_pct",
                ],
            )
        else:
            intraday_indicators = {}

        # Analyze sentiment
        sentiment = await self.tools.execute("analyze_sentiment", symbol=symbol)

        # Compile analysis
        analysis = {
            "symbol": symbol,
            "market_data": market_data,
            "intraday_market_data": intraday_market_data,
            "stock_info": stock_info,
            "indicators": indicators,
            "intraday_indicators": intraday_indicators,
            "sentiment": sentiment,
        }

        # Use LLM to synthesize insights
        prompt = f"""Analyze the following data for {symbol} and provide insights:

Stock Info: {stock_info}
Technical Indicators: {indicators}
Sentiment: {sentiment}

Provide:
1. Overall assessment (bullish/bearish/neutral)
2. Key technical signals
3. Risk factors
4. Recommended actions"""

        insights = await self.think(prompt)

        # Store in memory
        self.memory.add(
            MemoryType.ANALYSIS,
            content={"symbol": symbol, "analysis": analysis, "insights": insights},
            metadata={"task": "analyze_symbol"},
            importance=0.8,
        )

        return {
            "symbol": symbol,
            "analysis": analysis,
            "insights": insights,
        }

    async def _market_overview(self) -> dict[str, Any]:
        """Generate market overview for all symbols in context."""
        results = {}
        for symbol in self.context.symbols:
            results[symbol] = await self._analyze_symbol(symbol)

        # Generate overall market assessment
        prompt = f"""Based on the analysis of {len(results)} symbols:
{', '.join(self.context.symbols)}

Provide:
1. Overall market sentiment
2. Top opportunities
3. Key risks
4. Sector trends"""

        overview = await self.think(prompt)

        self.memory.add(
            MemoryType.OBSERVATION,
            content={"overview": overview, "symbols_analyzed": self.context.symbols},
            metadata={"task": "market_overview"},
            importance=0.9,
        )

        return {
            "symbols": results,
            "overview": overview,
        }

    async def _sentiment_analysis(self, symbol: str) -> dict[str, Any]:
        """Analyze sentiment for a specific symbol."""
        sentiment = await self.tools.execute("analyze_sentiment", symbol=symbol)

        # Enhance with LLM interpretation
        prompt = f"""Interpret the sentiment analysis for {symbol}:
{sentiment}

Provide:
1. Sentiment interpretation
2. Key themes in news
3. Potential impact on price
4. Confidence level"""

        interpretation = await self.think(prompt)

        return {
            "symbol": symbol,
            "raw_sentiment": sentiment,
            "interpretation": interpretation,
        }
