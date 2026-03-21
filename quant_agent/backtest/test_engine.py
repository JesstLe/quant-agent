"""Tests for the backtest engine."""

from datetime import date

import pandas as pd

from quant_agent.backtest.engine import BacktestEngine


def _sample_price_data() -> pd.DataFrame:
    dates = pd.date_range("2024-01-01", periods=8, freq="D")
    close_prices = [100, 101, 103, 102, 104, 106, 105, 108]

    return pd.DataFrame(
        {
            "Date": [d.date() for d in dates],
            "Open": close_prices,
            "High": [price + 1 for price in close_prices],
            "Low": [price - 1 for price in close_prices],
            "Close": close_prices,
            "Volume": [1_000_000] * len(close_prices),
            "symbol": ["AAPL"] * len(close_prices),
        }
    )


class TestBacktestEngine:
    """Tests for the backtest engine."""

    def test_run_returns_metrics_block(self, monkeypatch):
        """The engine should return the documented result structure."""
        engine = BacktestEngine(
            strategy_name="momentum",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 8),
            symbols=["AAPL"],
            initial_capital=10_000,
        )

        monkeypatch.setattr(engine, "_fetch_data", lambda: _sample_price_data())
        monkeypatch.setattr(engine, "_generate_signals", lambda data: data.assign(signal="hold", position=0))

        result = engine.run()

        assert "error" not in result
        assert "metrics" in result
        assert "trades" in result
        assert "equity_curve" in result
        assert result["metrics"]["strategy_name"] == "momentum"

    def test_run_handles_empty_data(self, monkeypatch):
        """The engine should fail gracefully when no historical data is available."""
        engine = BacktestEngine(
            strategy_name="momentum",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 8),
            symbols=["AAPL"],
            initial_capital=10_000,
        )

        monkeypatch.setattr(engine, "_fetch_data", lambda: pd.DataFrame())

        result = engine.run()

        assert result["error"] == "No data available for backtest"
        assert result["metrics"] == {}
