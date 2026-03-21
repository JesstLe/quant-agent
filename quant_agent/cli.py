"""Command-line interface for QuantAgent."""

import asyncio
from datetime import datetime
from typing import Optional

import click
from rich.console import Console
from rich.table import Table

console = Console()


@click.group()
@click.version_option(version="0.1.0")
def main():
    """QuantAgent - AI-powered quantitative trading agent system."""
    pass


@main.command()
@click.option("--mode", type=click.Choice(["paper", "live"]), default="paper", help="Trading mode")
@click.option("--strategy", type=str, default="momentum", help="Strategy to use")
@click.option("--symbols", type=str, help="Comma-separated list of symbols")
def start(mode: str, strategy: str, symbols: Optional[str]):
    """Start the trading agent system."""
    from quant_agent.agents.coordinator import CoordinatorAgent

    symbol_list = symbols.split(",") if symbols else ["AAPL", "MSFT", "GOOGL"]

    console.print(f"[bold green]Starting QuantAgent in {mode} mode[/]")
    console.print(f"Strategy: {strategy}")
    console.print(f"Symbols: {symbol_list}")

    async def run():
        coordinator = CoordinatorAgent(mode=mode)
        await coordinator.start(symbol_list, strategy)

    asyncio.run(run())


@main.command("run-backtest")
@click.option("--strategy", type=str, required=True, help="Strategy name")
@click.option("--start", type=str, required=True, help="Start date (YYYY-MM-DD)")
@click.option("--end", type=str, required=True, help="End date (YYYY-MM-DD)")
@click.option("--capital", type=float, default=100000, help="Initial capital")
@click.option("--symbols", type=str, help="Comma-separated symbols")
def run_backtest(strategy: str, start: str, end: str, capital: float, symbols: Optional[str]):
    """Run a backtest for a strategy."""
    from quant_agent.backtest.engine import BacktestEngine

    symbol_list = symbols.split(",") if symbols else ["AAPL"]

    console.print(f"[bold blue]Running Backtest[/]")
    console.print(f"Strategy: {strategy}")
    console.print(f"Period: {start} to {end}")
    console.print(f"Capital: ${capital:,.2f}")

    start_date = datetime.strptime(start, "%Y-%m-%d").date()
    end_date = datetime.strptime(end, "%Y-%m-%d").date()

    engine = BacktestEngine(
        strategy_name=strategy,
        start_date=start_date,
        end_date=end_date,
        initial_capital=capital,
        symbols=symbol_list,
    )

    results = engine.run()

    # Display results
    _display_backtest_results(results)


@main.command()
def agents():
    """List available agents and their status."""
    table = Table(title="Available Agents")
    table.add_column("Agent", style="cyan")
    table.add_column("Role", style="green")
    table.add_column("Status", style="yellow")

    agents_info = [
        ("Researcher", "Market research & data analysis", "Ready"),
        ("Strategist", "Strategy generation & signal creation", "Ready"),
        ("Risk Manager", "Risk assessment & position control", "Ready"),
        ("Executor", "Order execution & trade monitoring", "Ready"),
        ("Coordinator", "Task orchestration & decision integration", "Ready"),
    ]

    for name, role, status in agents_info:
        table.add_row(name, role, status)

    console.print(table)


@main.command()
@click.option("--symbol", type=str, required=True, help="Symbol to analyze")
def analyze(symbol: str):
    """Run AI analysis on a symbol."""
    from quant_agent.agents.researcher import ResearcherAgent

    console.print(f"[bold blue]Analyzing {symbol}...[/]")

    async def run_analysis():
        researcher = ResearcherAgent()
        analysis = await researcher.analyze(symbol)
        console.print(analysis)

    asyncio.run(run_analysis())


@main.command()
def dashboard():
    """Start the Streamlit dashboard."""
    import subprocess

    console.print("[bold green]Starting Dashboard...[/]")
    subprocess.run(["streamlit", "run", "dashboard/app.py"])


def _display_backtest_results(results: dict):
    """Display backtest results in a formatted table."""
    metrics = results.get("metrics", {})

    table = Table(title="Backtest Results")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")

    metric_names = [
        ("Total Return", f"{metrics.get('total_return', 0):.2%}"),
        ("Annualized Return", f"{metrics.get('annualized_return', 0):.2%}"),
        ("Sharpe Ratio", f"{metrics.get('sharpe_ratio', 0):.2f}"),
        ("Max Drawdown", f"{metrics.get('max_drawdown', 0):.2%}"),
        ("Win Rate", f"{metrics.get('win_rate', 0):.2%}"),
        ("Total Trades", str(metrics.get("total_trades", 0))),
        ("Final Capital", f"${metrics.get('final_capital', 0):,.2f}"),
    ]

    for name, value in metric_names:
        table.add_row(name, value)

    console.print(table)


if __name__ == "__main__":
    main()
