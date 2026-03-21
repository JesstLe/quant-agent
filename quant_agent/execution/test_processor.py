"""Tests for order processing in the executor agent."""

import pytest

from quant_agent.agents.base import AgentContext
from quant_agent.agents.executor import ExecutorAgent, OrderStatus
from quant_agent.agents.strategist import SignalType, TradingSignal
from quant_agent.core.memory import AgentMemory


class FakeLLM:
    """Minimal async LLM stub for unit tests."""

    async def generate(self, prompt, system_prompt=None, **kwargs):
        return "Test response"

    async def generate_with_history(self, messages, **kwargs):
        return "Test response"


def _build_signal() -> TradingSignal:
    return TradingSignal(
        symbol="AAPL",
        signal_type=SignalType.BUY,
        confidence=0.82,
        entry_price=150.0,
        target_price=165.0,
        stop_loss=142.5,
        rationale="Breakout with acceptable risk.",
        timeframe="medium",
        risk_reward_ratio=2.0,
        position_size_pct=0.1,
        metadata={},
    )


@pytest.fixture
def executor_agent() -> ExecutorAgent:
    agent = ExecutorAgent(llm=FakeLLM(), memory=AgentMemory())
    agent.set_context(
        AgentContext(
            symbols=["AAPL"],
            strategy="test",
            mode="paper",
            capital=100_000,
            metadata={},
        )
    )
    return agent


@pytest.mark.asyncio
async def test_place_order_creates_position(executor_agent: ExecutorAgent):
    """Paper execution should create a filled order and update positions on success."""
    result = await executor_agent.execute("place_order", signal=_build_signal())

    assert "success" in result
    assert "order" in result
    assert "execution" in result

    if result["success"]:
        assert result["execution"]["status"] == OrderStatus.FILLED.value
        positions = await executor_agent.execute("get_positions")
        assert positions["total_positions"] == 1


@pytest.mark.asyncio
async def test_execution_report_contains_summary(executor_agent: ExecutorAgent):
    """Execution reports should expose summary, quality, and order details."""
    await executor_agent.execute("place_order", signal=_build_signal())
    report = await executor_agent.execute("execution_report")

    assert "summary" in report
    assert "quality" in report
    assert "orders" in report
