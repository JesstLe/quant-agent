"""LLM interface for the agent system."""

from abc import ABC, abstractmethod
from typing import Any

from langchain_anthropic import ChatAnthropic
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from quant_agent.config import get_settings


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> str:
        """Generate a response from the LLM."""
        pass

    @abstractmethod
    async def generate_with_history(
        self,
        messages: list[BaseMessage],
        **kwargs: Any,
    ) -> str:
        """Generate a response with conversation history."""
        pass


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider."""

    def __init__(self, model: str = "claude-sonnet-4-20250514", **kwargs: Any):
        settings = get_settings()
        self.client: BaseChatModel = ChatAnthropic(
            model=model,
            api_key=settings.anthropic_api_key,
            **kwargs,
        )

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> str:
        messages = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        messages.append(HumanMessage(content=prompt))

        response = await self.client.ainvoke(messages)
        return response.content

    async def generate_with_history(
        self,
        messages: list[BaseMessage],
        **kwargs: Any,
    ) -> str:
        response = await self.client.ainvoke(messages)
        return response.content


class OpenAIProvider(LLMProvider):
    """OpenAI GPT provider."""

    def __init__(self, model: str = "gpt-4o", **kwargs: Any):
        settings = get_settings()
        self.client: BaseChatModel = ChatOpenAI(
            model=model,
            api_key=settings.openai_api_key,
            **kwargs,
        )

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> str:
        messages = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        messages.append(HumanMessage(content=prompt))

        response = await self.client.ainvoke(messages)
        return response.content

    async def generate_with_history(
        self,
        messages: list[BaseMessage],
        **kwargs: Any,
    ) -> str:
        response = await self.client.ainvoke(messages)
        return response.content


def get_llm(provider: str | None = None, model: str | None = None, **kwargs: Any) -> LLMProvider:
    """Factory function to get an LLM provider."""
    settings = get_settings()

    if provider is None:
        provider = "anthropic" if settings.anthropic_api_key else "openai"

    if provider == "anthropic":
        return AnthropicProvider(model=model or "claude-sonnet-4-20250514", **kwargs)
    elif provider == "openai":
        return OpenAIProvider(model=model or "gpt-4o", **kwargs)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")
