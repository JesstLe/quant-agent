"""Coordinator Agent - Task orchestration and decision integration."""

import asyncio
from datetime import datetime
from typing import Any

from quant_agent.agents.base import AgentContext, AgentRole, BaseAgent
from quant_agent.agents.executor import ExecutorAgent
from quant_agent.agents.researcher import ResearcherAgent
from quant_agent.agents.risk_manager import RiskManagerAgent
from quant_agent.agents.strategist import StrategistAgent
from quant_agent.core.llm import get_llm
from quant_agent.core.memory import AgentMemory


class CoordinatorAgent:
    """
    Coordinator Agent responsibilities:
    - Orchestrate tasks between specialized agents
    - Integrate decisions from multiple agents
    - Manage overall system state
    - Report and communicate status
    """

    def __init__(self, mode: str = "paper"):
        self.llm = get_llm()
        self.memory = AgentMemory()
        self.mode = mode

        # Initialize specialized agents
        self.researcher = ResearcherAgent(self.llm, self._create_tools())
        self.strategist = StrategistAgent(self.llm, self.memory)
        self.risk_manager = RiskManagerAgent(self.llm, self.memory)
        self.executor = ExecutorAgent(self.llm, self.memory)

    def _create_tools(self):
        from quant_agent.core.tools import ToolRegistry
        return ToolRegistry()

    async def start(self, symbols: list[str], strategy: str):
        """Start the trading agent system."""
        print(f"[Coordinator] Starting QuantAgent with symbols: {symbols}")
        print(f"[Coordinator] Strategy: {strategy}, Mode: {self.mode}")

        # Create shared context
        context = AgentContext(
            symbols=symbols,
            strategy=strategy,
            mode=self.mode,
            capital=100000.0,  # Default capital
            metadata={"start_time": datetime.now().isoformat()},
        )

        # Set context for all agents
        for agent in [self.researcher, self.strategist, self.risk_manager, self.executor]:
            agent.set_context(context)

        # Main orchestration loop
        try:
            while True:
                # Phase 1: Research
                print("\n[Coordinator] Phase 1: Conducting research...")
                research = await self.researcher.execute("market_overview")
                print(f"[Coordinator] Research complete for {len(research['symbols'])} symbols")

                # Phase 2: Strategy Generation
                print("\n[Coordinator] Phase 2: Generating trading signals...")
                signals = await self.strategist.execute("generate_signals", research_data=research)
                print(f"[Coordinator] Generated {signals['total_signals']} signals")
                print(f"[Coordinator] Buy signals: {signals['buy_signals']}, Sell signals: {signals['sell_signals']}")

                # Phase 3: Risk Assessment
                print("\n[Coordinator] Phase 3: Assessing portfolio risk...")
                portfolio_risk = await self.risk_manager.execute("portfolio_risk")
                print(f"[Coordinator] Portfolio risk score: {portfolio_risk['risk_score']}")

                # Phase 4: Execute Approved Trades
                for signal in signals["signals"]:
                    if signal["signal_type"] != "hold":
                        assessment = await self.risk_manager.execute(
                            "assess_trade",
                            signal=signal,
                            current_price=signal.get("entry_price", 100),
                        )

                        if assessment["approved"]:
                            print(f"[Coordinator] Approved trade for {signal['symbol']}")
                            await self.executor.execute("place_order", signal=signal)
                        else:
                            print(f"[Coordinator] Trade rejected for {signal['symbol']}: {assessment['rationale']}")

                # Phase 5: Execution Report
                print("\n[Coordinator] Phase 5: Generating execution report...")
                report = await self.executor.execute("execution_report")
                print(f"[Coordinator] Fill rate: {report['summary']['fill_rate']:.1%}")

                # Wait for next cycle (e.g., hourly)
                print("\n[Coordinator] Cycle complete. Waiting 1 hour for next cycle...")
                await asyncio.sleep(3600)  # 1 hour

        except asyncio.Cancelled:
            print("[Coordinator] System stopped by user")
        except Exception as e:
            print(f"[Coordinator] Error: {e}")
            raise
