"""Tests for backtest engine."""

import pytest
from datetime import date

from quant_agent.backtest.engine import BacktestEngine, BacktestConfig


class TestBacktestEngine:
    """Tests for the backtest engine."""

    def test_momentum_strategy(self):
        """Test momentum strategy."""
        engine = BacktestEngine(
            strategy_name="momentum",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            symbols=["AAPL"],
            initial_capital=10000,
        )

        result = engine.run()

        assert "error" not in result
        assert "total_return_pct" in result
        assert "trades" in result

    def test_mean_reversion_strategy(self):
        """Test mean reversion strategy."""
        engine = BacktestEngine(
            strategy_name="mean_reversion",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
            symbols=["AAPL"],
            initial_capital=10000,
        )

        result = engine.run()

        assert "error" not in result
        assert "total_return_pct" in result
