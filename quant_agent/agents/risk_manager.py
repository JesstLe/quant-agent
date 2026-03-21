"""Risk Manager Agent - Risk assessment and position control."""

from dataclasses import dataclass
from typing import Any

from quant_agent.agents.base import AgentRole, BaseAgent
from quant_agent.agents.strategist import TradingSignal
from quant_agent.core.llm import LLMProvider
from quant_agent.core.memory import AgentMemory, MemoryType


@dataclass
class RiskAssessment:
    """Risk assessment for a trade or portfolio."""

    approved: bool
    risk_score: float  # 0-1, higher = more risky
    max_position_size: float
    suggested_stop_loss: float | None
    warnings: list[str]
    rationale: str


class RiskManagerAgent(BaseAgent):
    """
    Risk Manager Agent responsibilities:
    - Assess risk of proposed trades
    - Enforce position size limits
    - Monitor portfolio exposure
    - Calculate VaR and other risk metrics
    """

    def __init__(self, llm: LLMProvider, memory: AgentMemory | None = None):
        super().__init__(AgentRole.RISK_MANAGER, llm, memory)
        self._positions: dict[str, float] = {}  # symbol -> position value
        self._daily_pnl: float = 0.0

    @property
    def system_prompt(self) -> str:
        return """You are a Risk Manager Agent responsible for protecting capital.

Your responsibilities:
1. Evaluate risk of all proposed trades
2. Enforce position size and exposure limits
3. Monitor portfolio-level risks
4. Calculate and track risk metrics (VaR, drawdown, etc.)

Risk Rules (NON-NEGOTIABLE):
- Maximum 10% of capital in any single position
- Maximum 2% daily loss limit
- Maximum 6% weekly loss limit
- No trades without stop loss
- Consider correlation between positions

Warning Signs to Flag:
- Unusual volatility
- Low liquidity
- High correlation with existing positions
- News events that could impact position
- Approaching key technical levels

You must be conservative - when in doubt, REJECT the trade."""

    async def execute(self, task: str, **kwargs: Any) -> dict[str, Any]:
        """Execute a risk management task."""
        if task == "assess_trade":
            return await self._assess_trade(kwargs.get("signal"), kwargs.get("current_price"))
        elif task == "portfolio_risk":
            return await self._portfolio_risk()
        elif task == "check_limits":
            return await self._check_limits()
        else:
            return {"error": f"Unknown task: {task}"}

    async def _assess_trade(
        self, signal: TradingSignal | dict[str, Any] | None, current_price: float | None
    ) -> dict[str, Any]:
        """Assess the risk of a proposed trade."""
        signal_obj = self._normalize_signal(signal)
        if signal_obj is None:
            return {"error": "No signal provided"}

        # Calculate position metrics
        capital = self.context.capital
        max_position = capital * 0.1  # 10% max position

        warnings = []
        approved = True
        risk_score = 0.0

        # Check confidence
        if signal_obj.confidence < 0.6:
            warnings.append(f"Low confidence signal: {signal_obj.confidence:.2f}")
            risk_score += 0.2

        # Check if stop loss exists
        if signal_obj.stop_loss is None:
            warnings.append("No stop loss defined - REJECTING")
            approved = False
        else:
            # Calculate risk per share
            entry = signal_obj.entry_price or current_price or 0
            risk_per_share = abs(entry - signal_obj.stop_loss)
            risk_ratio = risk_per_share / entry if entry > 0 else 0

            if risk_ratio > 0.05:  # More than 5% risk per trade
                warnings.append(f"High risk per trade: {risk_ratio:.1%}")
                risk_score += 0.3

        # Check existing positions
        if signal_obj.symbol in self._positions:
            warnings.append(f"Already have position in {signal_obj.symbol}")
            risk_score += 0.1

        # Check portfolio concentration
        total_exposure = sum(self._positions.values())
        if total_exposure / capital > 0.8:
            warnings.append("Portfolio highly exposed (>80%)")
            risk_score += 0.2

        # Use LLM for additional analysis
        prompt = f"""Assess risk for this trade:

Signal: {signal_obj.symbol} {signal_obj.signal_type.value}
Confidence: {signal_obj.confidence}
Entry: {signal_obj.entry_price}
Target: {signal_obj.target_price}
Stop Loss: {signal_obj.stop_loss}
Current Capital: {capital}
Current Exposure: {total_exposure}

Warnings already identified: {warnings}

Provide:
1. Final approval (yes/no)
2. Maximum position size recommendation
3. Additional risk factors
4. Suggested modifications"""

        llm_assessment = await self.think(prompt)

        # Cap risk score at 1.0
        risk_score = min(1.0, risk_score)

        assessment = RiskAssessment(
            approved=approved and risk_score < 0.7,
            risk_score=risk_score,
            max_position_size=min(max_position, capital * (1 - risk_score) * 0.1),
            suggested_stop_loss=signal_obj.stop_loss,
            warnings=warnings,
            rationale=llm_assessment,
        )

        # Store assessment in memory
        self.memory.add(
            MemoryType.DECISION,
            content={
                "symbol": signal_obj.symbol,
                "assessment": assessment.__dict__,
                "signal": signal_obj.to_dict(),
            },
            metadata={"task": "assess_trade"},
            importance=0.8,
        )

        return {
            "symbol": signal_obj.symbol,
            "approved": assessment.approved,
            "risk_score": assessment.risk_score,
            "max_position_size": assessment.max_position_size,
            "suggested_stop_loss": assessment.suggested_stop_loss,
            "warnings": assessment.warnings,
            "rationale": assessment.rationale,
        }

    async def _portfolio_risk(self) -> dict[str, Any]:
        """Calculate portfolio-level risk metrics."""
        capital = self.context.capital
        total_exposure = sum(self._positions.values())

        # Calculate basic metrics
        exposure_ratio = total_exposure / capital if capital > 0 else 0
        num_positions = len([p for p in self._positions.values() if p > 0])
        risk_score = min(
            1.0,
            exposure_ratio * 0.6
            + min(num_positions / max(len(self.context.symbols), 1), 1.0) * 0.2
            + (abs(min(self._daily_pnl, 0)) / max(capital * 0.02, 1)) * 0.2,
        )

        # Use LLM for comprehensive risk analysis
        prompt = f"""Analyze portfolio risk:

Capital: ${capital:,.2f}
Total Exposure: ${total_exposure:,.2f} ({exposure_ratio:.1%})
Number of Positions: {num_positions}
Positions: {self._positions}
Daily P&L: ${self._daily_pnl:,.2f}

Calculate and assess:
1. Value at Risk (VaR) at 95% confidence
2. Maximum drawdown risk
3. Concentration risk
4. Correlation risk
5. Overall risk level (low/medium/high)
6. Recommendations"""

        analysis = await self.think(prompt)

        risk_metrics = {
            "capital": capital,
            "total_exposure": total_exposure,
            "exposure_ratio": exposure_ratio,
            "num_positions": num_positions,
            "daily_pnl": self._daily_pnl,
            "risk_score": risk_score,
            "analysis": analysis,
        }

        self.memory.add(
            MemoryType.OBSERVATION,
            content=risk_metrics,
            metadata={"task": "portfolio_risk"},
            importance=0.7,
        )

        return risk_metrics

    @staticmethod
    def _normalize_signal(signal: TradingSignal | dict[str, Any] | None) -> TradingSignal | None:
        if signal is None:
            return None
        if isinstance(signal, TradingSignal):
            return signal
        return TradingSignal.from_dict(signal)

    async def _check_limits(self) -> dict[str, Any]:
        """Check if any risk limits are breached."""
        capital = self.context.capital
        daily_loss_limit = capital * 0.02

        breaches = []

        # Check daily loss
        if self._daily_pnl < -daily_loss_limit:
            breaches.append({
                "type": "daily_loss",
                "message": f"Daily loss limit exceeded: ${abs(self._daily_pnl):,.2f} > ${daily_loss_limit:,.2f}",
                "action": "halt_trading",
            })

        # Check position concentration
        for symbol, position in self._positions.items():
            if position / capital > 0.1:
                breaches.append({
                    "type": "position_concentration",
                    "message": f"{symbol} position exceeds 10%: {position/capital:.1%}",
                    "action": "reduce_position",
                })

        return {
            "breaches": breaches,
            "trading_allowed": len([b for b in breaches if b["action"] == "halt_trading"]) == 0,
            "daily_pnl": self._daily_pnl,
            "loss_limit": daily_loss_limit,
        }

    def update_position(self, symbol: str, value: float):
        """Update position value."""
        self._positions[symbol] = value

    def update_pnl(self, pnl: float):
        """Update daily P&L."""
        self._daily_pnl += pnl
