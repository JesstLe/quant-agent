"""Base agent classes and interfaces."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any

from quant_agent.core.llm import LLMProvider
from quant_agent.core.memory import AgentMemory


class AgentRole(Enum):
    """Roles that agents can play."""

    RESEARCHER = "researcher"
    STRATEGIST = "strategist"
    RISK_MANAGER = "risk_manager"
    EXECUTOR = "executor"
    COORDINATOR = "coordinator"


@dataclass
class AgentContext:
    """Shared context for agent execution."""

    symbols: list[str]
    strategy: str
    mode: str  # "paper" or "live"
    capital: float
    metadata: dict[str, Any]


class BaseAgent(ABC):
    """Base class for all agents."""

    def __init__(
        self,
        role: AgentRole,
        llm: LLMProvider,
        memory: AgentMemory | None = None,
    ):
        self.role = role
        self.llm = llm
        self.memory = memory or AgentMemory()
        self._context: AgentContext | None = None

    def set_context(self, context: AgentContext):
        """Set the execution context."""
        self._context = context

    @property
    def context(self) -> AgentContext:
        if self._context is None:
            raise RuntimeError("Agent context not set")
        return self._context

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """Get the system prompt for this agent."""
        pass

    @abstractmethod
    async def execute(self, task: str, **kwargs: Any) -> dict[str, Any]:
        """Execute a task and return results."""
        pass

    async def think(self, prompt: str) -> str:
        """Use LLM to process a prompt."""
        return await self.llm.generate(prompt, system_prompt=self.system_prompt)
