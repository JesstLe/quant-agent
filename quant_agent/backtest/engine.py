"""Backtesting engine for strategy validation."""

import random
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf


@dataclass
class BacktestConfig:
    """Configuration for backtest run."""

    initial_capital: float = 100000.0
    commission_per_trade: float = 1.0  # $1 per trade
    slippage_pct: float = 0.001  # 0.1%
    position_size_pct: float = 0.1  # 10% per position
    stop_loss_pct: float = 0.05  # 5% stop loss
    take_profit_ratio: float = 2.0  # 2:1 R/R
    max_positions: int = 10  # Maximum concurrent positions
    risk_free_rate: float = 0.04  # 4% annual


@dataclass
class Trade:
    """A single trade in the backtest."""

    trade_id: int
    entry_date: date
    exit_date: date | None
    symbol: str
    side: str  # "long" or "short"
    entry_price: float
    exit_price: float | None
    quantity: float
    stop_loss: float | None = None
    take_profit: float | None = None
    pnl: float = 0.0
    return_pct: float = 0.0
    commission: float = 0.0
    holding_days: int = 0
    exit_reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "trade_id": self.trade_id,
            "entry_date": str(self.entry_date),
            "exit_date": str(self.exit_date) if self.exit_date else None,
            "symbol": self.symbol,
            "side": self.side,
            "entry_price": self.entry_price,
            "exit_price": self.exit_price,
            "quantity": self.quantity,
            "stop_loss": self.stop_loss,
            "take_profit": self.take_profit,
            "pnl": self.pnl,
            "return_pct": self.return_pct,
            "commission": self.commission,
            "holding_days": self.holding_days,
            "exit_reason": self.exit_reason,
        }


@dataclass
class BacktestResult:
    """Results from a backtest run."""

    strategy_name: str
    start_date: date
    end_date: date
    initial_capital: float
    final_capital: float
    total_return_pct: float
    annualized_return_pct: float
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown_pct: float
    win_rate: float
    profit_factor: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    avg_win_pct: float
    avg_loss_pct: float
    avg_holding_days: float
    trades: list[Trade]
    equity_curve: list[float]
    daily_returns: list[float]

    def to_dict(self) -> dict[str, Any]:
        return {
            "strategy_name": self.strategy_name,
            "start_date": str(self.start_date),
            "end_date": str(self.end_date),
            "initial_capital": self.initial_capital,
            "final_capital": self.final_capital,
            "total_return": self.total_return_pct,
            "annualized_return": self.annualized_return_pct,
            "sharpe_ratio": self.sharpe_ratio,
            "sortino_ratio": self.sortino_ratio,
            "max_drawdown": self.max_drawdown_pct,
            "win_rate": self.win_rate,
            "profit_factor": self.profit_factor,
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "avg_win_pct": self.avg_win_pct,
            "avg_loss_pct": self.avg_loss_pct,
            "avg_holding_days": self.avg_holding_days,
            "trades": [t.to_dict() for t in self.trades],
        }


class BacktestEngine:
    """
    Backtesting engine for validating trading strategies.

    Features:
    - Multiple strategy types (momentum, mean reversion, breakout, pairs)
    - Realistic commission and slippage modeling
    - Position sizing and risk management
    - Stop loss / take profit execution
    - Comprehensive performance metrics
    """

    STRATEGIES = {
        "momentum": "Momentum strategy using moving average crossovers",
        "mean_reversion": "Mean reversion strategy using RSI and Bollinger Bands",
        "breakout": "Breakout strategy based on price channels",
        "trend_following": "Trend following with ADX confirmation",
        "dual_momentum": "Dual momentum (relative + absolute)",
    }

    def __init__(
        self,
        strategy_name: str,
        start_date: date,
        end_date: date,
        initial_capital: float = 100000.0,
        symbols: list[str] | None = None,
        config: BacktestConfig | None = None,
    ):
        self.strategy_name = strategy_name
        self.start_date = start_date
        self.end_date = end_date
        self.initial_capital = initial_capital
        self.symbols = symbols or ["AAPL"]
        self.config = config or BacktestConfig(initial_capital=initial_capital)

        # State tracking
        self.cash = initial_capital
        self.positions: dict[str, dict[str, Any]] = {}  # symbol -> position details
        self.open_trades: dict[str, Trade] = {}  # symbol -> open trade
        self.trades: list[Trade] = []
        self.equity_curve: list[float] = [initial_capital]
        self.daily_returns: list[float] = []
        self._trade_counter = 0
        self._price_data: pd.DataFrame | None = None

    def run(self) -> dict[str, Any]:
        """Run the backtest and return results."""
        # Fetch historical data
        self._price_data = self._fetch_data()

        if self._price_data.empty:
            return {"error": "No data available for backtest", "metrics": {}}

        # Generate signals based on strategy
        signals = self._generate_signals(self._price_data)

        # Execute backtest simulation
        self._execute_backtest(self._price_data, signals)

        # Calculate comprehensive results
        results = self._calculate_results()

        return {
            "metrics": results.to_dict(),
            "trades": [t.to_dict() for t in self.trades],
            "equity_curve": self.equity_curve,
        }

    def _fetch_data(self) -> pd.DataFrame:
        """Fetch historical price data for all symbols."""
        all_data = []

        for symbol in self.symbols:
            try:
                ticker = yf.Ticker(symbol)
                df = ticker.history(
                    start=self.start_date - timedelta(days=100),
                    end=self.end_date + timedelta(days=1),
                    interval="1d",
                    auto_adjust=False,
                )
                if not df.empty:
                    df["symbol"] = symbol
                    df = df.reset_index()
                    df["Date"] = pd.to_datetime(df["Date"]).dt.date
                    all_data.append(df)
            except Exception as e:
                print(f"Warning: Could not fetch data for {symbol}: {e}")

        if not all_data:
            return pd.DataFrame()

        combined = pd.concat(all_data, ignore_index=True)
        return combined.sort_values(["Date", "symbol"])

    def _generate_signals(self, data: pd.DataFrame) -> pd.DataFrame:
        """Generate trading signals based on the selected strategy."""
        all_signals = []

        for symbol in self.symbols:
            symbol_data = data[data["symbol"] == symbol].copy()

            if symbol_data.empty:
                continue

            if self.strategy_name == "momentum":
                signals = self._momentum_signals(symbol_data)
            elif self.strategy_name == "mean_reversion":
                signals = self._mean_reversion_signals(symbol_data)
            elif self.strategy_name == "breakout":
                signals = self._breakout_signals(symbol_data)
            elif self.strategy_name == "trend_following":
                signals = self._trend_following_signals(symbol_data)
            else:
                signals = self._momentum_signals(symbol_data)  # Default

            signals["symbol"] = symbol
            all_signals.append(signals)

        if not all_signals:
            return pd.DataFrame()

        return pd.concat(all_signals, ignore_index=True)

    def _momentum_signals(self, data: pd.DataFrame) -> pd.DataFrame:
        """Generate momentum signals using SMA crossovers with MACD confirmation."""
        data = data.copy()
        data["sma_20"] = data["Close"].rolling(window=20).mean()
        data["sma_50"] = data["Close"].rolling(window=50).mean()
        data["sma_200"] = data["Close"].rolling(window=200).mean()

        # MACD
        data["ema_12"] = data["Close"].ewm(span=12).mean()
        data["ema_26"] = data["Close"].ewm(span=26).mean()
        data["macd"] = data["ema_12"] - data["ema_26"]
        data["macd_signal"] = data["macd"].ewm(span=9).mean()
        data["macd_hist"] = data["macd"] - data["macd_signal"]

        data["signal"] = "hold"
        data["position"] = 0

        for i in range(1, len(data)):
            prev = data.iloc[i - 1]
            curr = data.iloc[i]

            # Buy: SMA20 > SMA50 and MACD histogram positive
            if (prev["sma_20"] <= prev["sma_50"] and curr["sma_20"] > curr["sma_50"]
                    and curr["macd_hist"] > 0):
                data.loc[data.index[i], "signal"] = "buy"
                data.loc[data.index[i], "position"] = 1
            # Sell: SMA20 < SMA50
            elif prev["sma_20"] >= prev["sma_50"] and curr["sma_20"] < curr["sma_50"]:
                data.loc[data.index[i], "signal"] = "sell"
                data.loc[data.index[i], "position"] = -1

        return data[["Date", "signal", "position", "Close"]]

    def _mean_reversion_signals(self, data: pd.DataFrame) -> pd.DataFrame:
        """Generate mean reversion signals using RSI and Bollinger Bands."""
        data = data.copy()

        # RSI
        delta = data["Close"].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        data["rsi"] = 100 - (100 / (1 + rs))

        # Bollinger Bands
        data["sma_20"] = data["Close"].rolling(window=20).mean()
        data["std_20"] = data["Close"].rolling(window=20).std()
        data["bb_upper"] = data["sma_20"] + (data["std_20"] * 2)
        data["bb_lower"] = data["sma_20"] - (data["std_20"] * 2)

        data["signal"] = "hold"
        data["position"] = 0

        for i in range(1, len(data)):
            curr = data.iloc[i]

            # Buy: RSI oversold (<30) and price below lower BB
            if curr["rsi"] < 30 and curr["Close"] < curr["bb_lower"]:
                data.loc[data.index[i], "signal"] = "buy"
                data.loc[data.index[i], "position"] = 1
            # Sell: RSI overbought (>70) and price above upper BB
            elif curr["rsi"] > 70 and curr["Close"] > curr["bb_upper"]:
                data.loc[data.index[i], "signal"] = "sell"
                data.loc[data.index[i], "position"] = -1

        return data[["Date", "signal", "position", "Close"]]

    def _breakout_signals(self, data: pd.DataFrame) -> pd.DataFrame:
        """Generate breakout signals based on price channels."""
        data = data.copy()

        # Donchian Channel
        data["high_20"] = data["High"].rolling(window=20).max()
        data["low_20"] = data["Low"].rolling(window=20).min()

        data["signal"] = "hold"
        data["position"] = 0

        for i in range(1, len(data)):
            prev = data.iloc[i - 1]
            curr = data.iloc[i]

            # Buy: Price breaks above 20-day high
            if curr["Close"] > prev["high_20"]:
                data.loc[data.index[i], "signal"] = "buy"
                data.loc[data.index[i], "position"] = 1
            # Sell: Price breaks below 20-day low
            elif curr["Close"] < prev["low_20"]:
                data.loc[data.index[i], "signal"] = "sell"
                data.loc[data.index[i], "position"] = -1

        return data[["Date", "signal", "position", "Close"]]

    def _trend_following_signals(self, data: pd.DataFrame) -> pd.DataFrame:
        """Generate trend following signals with ADX confirmation."""
        data = data.copy()

        # Moving averages
        data["sma_50"] = data["Close"].rolling(window=50).mean()
        data["sma_200"] = data["Close"].rolling(window=200).mean()

        # ADX calculation
        high_diff = data["High"].diff()
        low_diff = -data["Low"].diff()
        plus_dm = np.where((high_diff > low_diff) & (high_diff > 0), high_diff, 0)
        minus_dm = np.where((low_diff > high_diff) & (low_diff > 0), low_diff, 0)

        tr = np.maximum(
            data["High"] - data["Low"],
            np.maximum(
                abs(data["High"] - data["Close"].shift(1)),
                abs(data["Low"] - data["Close"].shift(1)),
            ),
        )

        atr = pd.Series(tr).rolling(window=14).mean()
        plus_di = 100 * pd.Series(plus_dm).rolling(window=14).mean() / atr
        minus_di = 100 * pd.Series(minus_dm).rolling(window=14).mean() / atr
        dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
        data["adx"] = dx.rolling(window=14).mean()

        data["signal"] = "hold"
        data["position"] = 0

        for i in range(1, len(data)):
            curr = data.iloc[i]

            # Buy: SMA50 > SMA200 and ADX > 25 (strong trend)
            if curr["sma_50"] > curr["sma_200"] and curr["adx"] > 25:
                data.loc[data.index[i], "signal"] = "buy"
                data.loc[data.index[i], "position"] = 1
            # Sell: SMA50 < SMA200 and ADX > 25
            elif curr["sma_50"] < curr["sma_200"] and curr["adx"] > 25:
                data.loc[data.index[i], "signal"] = "sell"
                data.loc[data.index[i], "position"] = -1

        return data[["Date", "signal", "position", "Close"]]

    def _execute_backtest(self, data: pd.DataFrame, signals: pd.DataFrame):
        """Execute the backtest simulation."""
        unique_dates = sorted(data["Date"].unique())

        for current_date in unique_dates:
            # Get signals for this date
            day_signals = signals[signals["Date"] == current_date]
            day_prices = data[data["Date"] == current_date]

            # Process signals
            for _, signal_row in day_signals.iterrows():
                symbol = signal_row["symbol"]
                action = signal_row["signal"]
                price = signal_row["Close"]

                if action == "buy" and symbol not in self.open_trades:
                    self._open_position(symbol, current_date, price)
                elif action == "sell" and symbol in self.open_trades:
                    self._close_position(symbol, current_date, price, "signal")

            # Check stop losses and take profits
            for symbol, trade in list(self.open_trades.items()):
                symbol_price = day_prices[day_prices["symbol"] == symbol]
                if not symbol_price.empty:
                    current_price = symbol_price["Close"].iloc[0]
                    self._check_exit_conditions(symbol, current_date, current_price)

            # Update equity curve
            total_equity = self._calculate_equity(day_prices)
            self.equity_curve.append(total_equity)

            # Calculate daily return
            if len(self.equity_curve) > 1:
                daily_return = (self.equity_curve[-1] - self.equity_curve[-2]) / self.equity_curve[-2]
                self.daily_returns.append(daily_return)

    def _open_position(self, symbol: str, date: date, price: float):
        """Open a new position."""
        if len(self.open_trades) >= self.config.max_positions:
            return

        # Calculate position size
        position_value = self.cash * self.config.position_size_pct
        adjusted_price = price * (1 + self.config.slippage_pct)  # Buy slippage
        quantity = position_value / adjusted_price
        commission = self.config.commission_per_trade

        if quantity > 0 and self.cash >= position_value + commission:
            self._trade_counter += 1

            # Calculate stop loss and take profit
            stop_loss = adjusted_price * (1 - self.config.stop_loss_pct)
            take_profit = adjusted_price * (1 + self.config.stop_loss_pct * self.config.take_profit_ratio)

            trade = Trade(
                trade_id=self._trade_counter,
                entry_date=date,
                exit_date=None,
                symbol=symbol,
                side="long",
                entry_price=adjusted_price,
                exit_price=None,
                quantity=quantity,
                stop_loss=stop_loss,
                take_profit=take_profit,
                commission=commission,
            )

            self.open_trades[symbol] = trade
            self.cash -= position_value + commission

    def _close_position(self, symbol: str, date: date, price: float, reason: str):
        """Close an existing position."""
        if symbol not in self.open_trades:
            return

        trade = self.open_trades[symbol]
        adjusted_price = price * (1 - self.config.slippage_pct)  # Sell slippage
        commission = self.config.commission_per_trade

        proceeds = trade.quantity * adjusted_price
        self.cash += proceeds - commission

        # Update trade record
        trade.exit_date = date
        trade.exit_price = adjusted_price
        trade.pnl = proceeds - (trade.entry_price * trade.quantity) - trade.commission - commission
        trade.return_pct = (trade.pnl / (trade.entry_price * trade.quantity)) * 100
        trade.holding_days = (date - trade.entry_date).days
        trade.exit_reason = reason

        self.trades.append(trade)
        del self.open_trades[symbol]

    def _check_exit_conditions(self, symbol: str, date: date, current_price: float):
        """Check if stop loss or take profit should be triggered."""
        if symbol not in self.open_trades:
            return

        trade = self.open_trades[symbol]

        if trade.stop_loss and current_price <= trade.stop_loss:
            self._close_position(symbol, date, current_price, "stop_loss")
        elif trade.take_profit and current_price >= trade.take_profit:
            self._close_position(symbol, date, current_price, "take_profit")

    def _calculate_equity(self, day_prices: pd.DataFrame) -> float:
        """Calculate total portfolio equity."""
        equity = self.cash

        for symbol, trade in self.open_trades.items():
            symbol_data = day_prices[day_prices["symbol"] == symbol]
            if not symbol_data.empty:
                current_price = symbol_data["Close"].iloc[0]
                equity += trade.quantity * current_price

        return equity

    def _calculate_results(self) -> BacktestResult:
        """Calculate comprehensive backtest performance metrics."""
        final_equity = self.equity_curve[-1]
        total_return = (final_equity - self.initial_capital) / self.initial_capital * 100

        # Annualized return
        days = (self.end_date - self.start_date).days
        years = days / 365
        annualized_return = ((final_equity / self.initial_capital) ** (1 / years) - 1) * 100 if years > 0 else 0

        # Calculate max drawdown
        peak = self.initial_capital
        max_drawdown = 0

        for equity in self.equity_curve:
            if equity > peak:
                peak = equity
            drawdown = (peak - equity) / peak * 100
            max_drawdown = max(max_drawdown, drawdown)

        # Calculate Sharpe ratio
        if self.daily_returns:
            daily_returns = np.array(self.daily_returns)
            excess_returns = daily_returns - (self.config.risk_free_rate / 252)
            sharpe_ratio = np.mean(excess_returns) / np.std(excess_returns) * np.sqrt(252) if np.std(excess_returns) > 0 else 0
        else:
            sharpe_ratio = 0

        # Calculate Sortino ratio
        if self.daily_returns:
            negative_returns = np.array([r for r in self.daily_returns if r < 0])
            downside_std = np.std(negative_returns) * np.sqrt(252) if len(negative_returns) > 0 else 0
            sortino_ratio = (annualized_return - self.config.risk_free_rate * 100) / downside_std if downside_std > 0 else 0
        else:
            sortino_ratio = 0

        # Trade statistics
        completed_trades = [t for t in self.trades if t.exit_date]
        winning_trades = [t for t in completed_trades if t.pnl > 0]
        losing_trades = [t for t in completed_trades if t.pnl < 0]

        total_trades = len(completed_trades)
        win_count = len(winning_trades)
        loss_count = len(losing_trades)
        win_rate = (win_count / total_trades * 100) if total_trades > 0 else 0

        # Average win/loss
        avg_win = np.mean([t.return_pct for t in winning_trades]) if winning_trades else 0
        avg_loss = np.mean([t.return_pct for t in losing_trades]) if losing_trades else 0

        # Profit factor
        gross_profit = sum(t.pnl for t in winning_trades)
        gross_loss = abs(sum(t.pnl for t in losing_trades))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0

        # Average holding days
        avg_holding = np.mean([t.holding_days for t in completed_trades]) if completed_trades else 0

        return BacktestResult(
            strategy_name=self.strategy_name,
            start_date=self.start_date,
            end_date=self.end_date,
            initial_capital=self.initial_capital,
            final_capital=final_equity,
            total_return_pct=total_return,
            annualized_return_pct=annualized_return,
            sharpe_ratio=sharpe_ratio,
            sortino_ratio=sortino_ratio,
            max_drawdown_pct=max_drawdown,
            win_rate=win_rate,
            profit_factor=profit_factor,
            total_trades=total_trades,
            winning_trades=win_count,
            losing_trades=loss_count,
            avg_win_pct=avg_win,
            avg_loss_pct=avg_loss,
            avg_holding_days=avg_holding,
            trades=completed_trades,
            equity_curve=self.equity_curve,
            daily_returns=self.daily_returns,
        )
