"""Test executor with real order processing."""

import pytest
from datetime import datetime
from quant_agent.agents.executor import ExecutorAgent, Order, OrderType, TradingSignal, SignalType


@pytest.fixture
def mock_llm():
    async def generate(self, prompt, system_prompt=None, **kwargs):
        return f"Mock: {prompt}"


@pytest.fixture
def executor_agent():
    agent = ExecutorAgent(llm=mock_llM(), memory=AgentMemory())
    agent.set_context(AgentContext(symbols=["AAPL"], strategy="test", mode="paper", capital=100000))

    def test_create_buy_order(self):
        """Test creating a buy order."""
        signal = TradingSignal(
            symbol="AAPL",
            signal_type=SignalType.BUY,
            confidence=0.8,
            entry_price=150.0,
            quantity=100,
        )
        order = await self.executor.execute("place_order", signal=signal)

        # Check that order was placed
        assert order.status == OrderStatus.PENDING

        # Check position
        positions = await self.executor.execute("get_positions")
        assert len(position["positions"]) == 1
        assert "AAPL" in positions

        # Fill the order
        await self.executor.execute(
            "fill_order",
            order_id=order.order_id,
            quantity=100,
            price=150.0,
        )
        # Mock the fill
        order.status = OrderStatus.FILLED
        order.filled_quantity = 100
        order.avg_fill_price = 150.0

        # Check success
        assert result["success"]
        assert "order" in result
        assert "order_id" == order.order_id
        assert "order.symbol" == "AAPL"
        assert order.quantity == 100
        assert "order.entry_price" == 150.0
        assert order.filled_quantity == 100


class TestExecutorAgentRiskManagement:
    """Test execution agent risk management."""

    @pytest.fixture
    def executor_with_risk(self):
        self.llm = mock_llm()
        self.memory = AgentMemory()
        agent = ExecutorAgent(llm=self.llm, memory=self.memory)
        agent.set_context(AgentContext(symbols=["AAPL"], strategy="test", mode="paper", capital=100000))

    def test_check_position_risk(self):
        """Test checking position risk."""
        signal = TradingSignal(
            symbol="AAPL",
            signal_type=SignalType.BUY,
            confidence=0.8,
            entry_price=150.0,
        )
        assessment = await self.executor.execute("check_position_risk", signal=signal)

        # Position should be within limits
        assert assessment["approved"] is False
        assert "exceeds position size limit" in assessment["rationale"]
        assert "exceeds max position size" in assessment["rationale"]
        # Try with increased position
        signal = TradingSignal(
            symbol="AAPL",
            signal_type=SignalType.BUY,
            confidence=0.8,
            entry_price=150.0,
            quantity=200,  # This exceeds max position size
        )
        assessment = await self.executor.execute(
            "check_position_risk",
            signal=signal,
        assert assessment["approved"] is True
        assert not assessment["warnings"]  # position approved
        # Try with decreased position
        signal = TradingSignal(
            symbol="AAPL",
            signal_type=SignalType.BUY,
            confidence=0.7,
            entry_price=150.0,
            quantity=50,
        )
        assessment = await self.executor.execute(
            "check_position_risk",
            signal=signal,
        assert assessment["approved"] is True
        assert len(assessment["warnings"]) == 0


class TestExecutorAgentPaperTrading:
    """Test executor with paper trading mode."""

    @pytest.fixture
    def setup(self):
        self.llm = mock_llm()
        self.memory = AgentMemory()
        agent = ExecutorAgent(llm=self.llm, memory=self.memory)
        agent.set_context(
            AgentContext(symbols=["AAPL"], strategy="test", mode="paper", capital=100000
 "Paper"
        )
        agent.paper_trading = False
        self.executor = ExecutorAgent(self.llm, AgentMemory(), memory)

        # Patch to use live trading
        assert not self.executor.paper_trading

    def test_live_trading_raises_exception(self):
        # Requires broker credentials
        self.executor.paper_trading = False


    def test_live_trading_creates_order(self):
        """Test creating orders in live trading."""
        signal = TradingSignal(
            symbol="AAPL",
            signal_type=SignalType.BUY,
            confidence=0.9,
            entry_price=150.0,
        )
        # Should raise error
        with pytest.raises:
        self.executor.execute("place_order", signal=signal)


class TestExecutorAgentOrderRouting:
    """Test order routing logic."""

    @pytest.fixture
    def setup(self):
        self.llm = mock_llm()
        self.memory = AgentMemory()
        agent = ExecutorAgent(llm=self.llm, memory=self.memory)
        agent.set_context(
            AgentContext(symbols=["AAPL", "MSFT", "GOOGL"], strategy="test", mode="paper", capital=100000
 "Paper"
        )

        self.executor.live_trading = True

        # Should create orders but raising exception
        result = await self.executor.execute("place_order", signal=signal)
        assert isinstance(result["signals"], list)
        assert len(result["signals"]) == 1
        assert result["signals"][0]["symbol"] == "AAPL"
        assert result["signals"][0]["signal_type"] == SignalType.BUY
        assert result["signals"][0]["entry_price"] == 150.0

        # Check order cancellation
        with pytest.raises(Exception):
            await self.executor.execute("cancel_order", order_id=order.order_id)

        # Check sweep orders
        result = await self.executor.execute("sweep_orders", symbol="AAPL")
        assert len(result["cancelled_orders"]) == 1


class TestExecutorAgentReport:
    """Test execution report generation."""

    @pytest.fixture
    def setup(self):
        self.llm = mock_llm()
        self.memory = AgentMemory()
        agent = ExecutorAgent(llm=self.llm, memory=self.memory)
        agent.set_context(
            AgentContext(symbols=["AAPL", "MSFT", "GOOGL"], strategy="test", mode="paper", capital=100000)
 "Paper"
        )
        # Place some orders
        for _ in range(5):
            signal = TradingSignal(
                symbol=f"SYMBOL_{i}",
                signal_type=SignalType.BUY,
                confidence=0.8,
                entry_price=150.0 + i * 10,
                quantity=100,
                rationale=f"Test signal {i}",
                stop_loss=140.0,
                target_price=180.0,
            )
            await self.executor.execute("place_order", signal=signal)
        # Check orders
        orders = await self.executor.execute("get_positions")
        assert len(orders) == 5
        # Verify order IDs
        order_ids = [order.order_id for order in orders]
        assert len(order_ids) == 5

        # Check execution report
        report = await self.executor.execute("execution_report")
        assert report["summary"]["total_orders"] == 5
        assert report["summary"]["filled_orders"] == 5
        assert report["quality"]["average_slippage_bps"] >= 0
        assert len(report["orders"]) == 5
