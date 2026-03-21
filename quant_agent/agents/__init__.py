"""Agents module initialization."""

from quant_agent.agents.base import AgentContext, AgentRole, BaseAgent
from quant_agent.agents.coordinator import CoordinatorAgent
from quant_agent.agents.executor import ExecutorAgent
from quant_agent.agents.researcher import ResearcherAgent
from quant_agent.agents.risk_manager import RiskManagerAgent
from quant_agent.agents.strategist import StrategistAgent

__all__ = [
    "AgentContext",
    "AgentRole",
    "BaseAgent",
    "CoordinatorAgent",
    "ExecutorAgent",
    "ResearcherAgent",
    "RiskManagerAgent",
    "StrategistAgent",
]
