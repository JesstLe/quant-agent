"""
LLM interface supporting multiple providers.

Supported providers:
- International: OpenAI, Anthropic, Google Gemini, AWS Bedrock, Azure OpenAI, Groq, Cohere, Mistral, Together AI
- Chinese: DeepSeek, Alibaba Qwen, Baidu ERNIE, Zhipu GLM, Moonshot, iFlytek Spark, ByteDance Doubao, Yi
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Iterator

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.outputs import ChatResult

from quant_agent.config import get_settings


class ModelProvider(Enum):
    """Supported LLM providers."""

    # International
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    AWS_BEDROCK = "aws_bedrock"
    AZURE_OPENAI = "azure_openai"
    GROQ = "groq"
    COHERE = "cohere"
    MISTRAL = "mistral"
    TOGETHER = "together"
    REPLICATE = "replicate"

    # Chinese
    DEEPSEEK = "deepseek"
    QWEN = "qwen"  # Alibaba
    ERNIE = "ernie"  # Baidu
    GLM = "glm"  # Zhipu AI
    MOONSHOT = "moonshot"
    SPARK = "spark"  # iFlytek
    DOUBAO = "doubao"  # ByteDance
    YI = "yi"  # 01.AI
    BAICHUAN = "baichuan"
    MINIMAX = "minimax"
    SENSENOVA = "sensenova"  # SenseTime


@dataclass
class ModelConfig:
    """Configuration for a specific model."""

    provider: ModelProvider
    model_name: str
    api_key: str = ""
    base_url: str | None = None
    temperature: float = 0.7
    max_tokens: int = 4096
    timeout: int = 60
    extra_params: dict[str, Any] | None = None


# Default models for each provider
DEFAULT_MODELS: dict[ModelProvider, str] = {
    # International
    ModelProvider.OPENAI: "gpt-4o",
    ModelProvider.ANTHROPIC: "claude-sonnet-4-20250514",
    ModelProvider.GOOGLE: "gemini-2.0-flash",
    ModelProvider.AWS_BEDROCK: "anthropic.claude-3-sonnet-20240229-v1:0",
    ModelProvider.AZURE_OPENAI: "gpt-4o",
    ModelProvider.GROQ: "llama-3.3-70b-versatile",
    ModelProvider.COHERE: "command-r-plus",
    ModelProvider.MISTRAL: "mistral-large-latest",
    ModelProvider.TOGETHER: "meta-llama/Llama-3-70b-chat-hf",
    ModelProvider.REPLICATE: "meta/llama-2-70b-chat",
    # Chinese
    ModelProvider.DEEPSEEK: "deepseek-chat",
    ModelProvider.QWEN: "qwen-max",
    ModelProvider.ERNIE: "ernie-4.0-8k",
    ModelProvider.GLM: "glm-4",
    ModelProvider.MOONSHOT: "moonshot-v1-8k",
    ModelProvider.SPARK: "spark-v3.5",
    ModelProvider.DOUBAO: "doubao-pro-32k",
    ModelProvider.YI: "yi-large",
    ModelProvider.BAICHUAN: "Baichuan4",
    ModelProvider.MINIMAX: "abab6.5-chat",
    ModelProvider.SENSENOVA: "sensechat-5",
}

# API base URLs for providers that need them
PROVIDER_BASE_URLS: dict[ModelProvider, str] = {
    ModelProvider.DEEPSEEK: "https://api.deepseek.com/v1",
    ModelProvider.QWEN: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    ModelProvider.GLM: "https://open.bigmodel.cn/api/paas/v4",
    ModelProvider.MOONSHOT: "https://api.moonshot.cn/v1",
    ModelProvider.YI: "https://api.lingyiwanwu.com/v1",
    ModelProvider.BAICHUAN: "https://api.baichuan-ai.com/v1",
    ModelProvider.MINIMAX: "https://api.minimax.chat/v1",
    ModelProvider.TOGETHER: "https://api.together.xyz/v1",
    ModelProvider.GROQ: "https://api.groq.com/openai/v1",
}


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

    def generate_stream(
        self,
        prompt: str,
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> Iterator[str]:
        """Generate a streaming response (optional)."""
        # Default: non-streaming
        import asyncio
        return iter([asyncio.run(self.generate(prompt, system_prompt, **kwargs))])


class LangChainProvider(LLMProvider):
    """Provider using LangChain chat models."""

    def __init__(self, client: BaseChatModel):
        self.client = client

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


class OpenAIProvider(LangChainProvider):
    """OpenAI GPT provider."""

    def __init__(
        self,
        model: str = "gpt-4o",
        api_key: str | None = None,
        base_url: str | None = None,
        **kwargs: Any,
    ):
        from langchain_openai import ChatOpenAI

        settings = get_settings()
        client = ChatOpenAI(
            model=model,
            api_key=api_key or settings.openai_api_key,
            base_url=base_url,
            **kwargs,
        )
        super().__init__(client)


class AnthropicProvider(LangChainProvider):
    """Anthropic Claude provider."""

    def __init__(
        self,
        model: str = "claude-sonnet-4-20250514",
        api_key: str | None = None,
        **kwargs: Any,
    ):
        from langchain_anthropic import ChatAnthropic

        settings = get_settings()
        client = ChatAnthropic(
            model=model,
            api_key=api_key or settings.anthropic_api_key,
            **kwargs,
        )
        super().__init__(client)


class GoogleProvider(LangChainProvider):
    """Google Gemini provider."""

    def __init__(
        self,
        model: str = "gemini-2.0-flash",
        api_key: str | None = None,
        **kwargs: Any,
    ):
        from langchain_google_genai import ChatGoogleGenerativeAI

        settings = get_settings()
        client = ChatGoogleGenerativeAI(
            model=model,
            google_api_key=api_key or settings.google_api_key,
            **kwargs,
        )
        super().__init__(client)


class GroqProvider(LangChainProvider):
    """Groq provider for fast inference."""

    def __init__(
        self,
        model: str = "llama-3.3-70b-versatile",
        api_key: str | None = None,
        **kwargs: Any,
    ):
        from langchain_groq import ChatGroq

        settings = get_settings()
        client = ChatGroq(
            model=model,
            api_key=api_key or settings.groq_api_key,
            **kwargs,
        )
        super().__init__(client)


class MistralProvider(LangChainProvider):
    """Mistral AI provider."""

    def __init__(
        self,
        model: str = "mistral-large-latest",
        api_key: str | None = None,
        **kwargs: Any,
    ):
        from langchain_mistralai import ChatMistralAI

        settings = get_settings()
        client = ChatMistralAI(
            model=model,
            api_key=api_key or settings.mistral_api_key,
            **kwargs,
        )
        super().__init__(client)


class CohereProvider(LangChainProvider):
    """Cohere provider."""

    def __init__(
        self,
        model: str = "command-r-plus",
        api_key: str | None = None,
        **kwargs: Any,
    ):
        from langchain_cohere import ChatCohere

        settings = get_settings()
        client = ChatCohere(
            model=model,
            cohere_api_key=api_key or settings.cohere_api_key,
            **kwargs,
        )
        super().__init__(client)


class DeepSeekProvider(LangChainProvider):
    """DeepSeek provider (OpenAI-compatible API)."""

    def __init__(
        self,
        model: str = "deepseek-chat",
        api_key: str | None = None,
        **kwargs: Any,
    ):
        from langchain_openai import ChatOpenAI

        settings = get_settings()
        client = ChatOpenAI(
            model=model,
            api_key=api_key or settings.deepseek_api_key,
            base_url=PROVIDER_BASE_URLS[ModelProvider.DEEPSEEK],
            **kwargs,
        )
        super().__init__(client)


class QwenProvider(LangChainProvider):
    """Alibaba Qwen (通义千问) provider (OpenAI-compatible)."""

    def __init__(
        self,
        model: str = "qwen-max",
        api_key: str | None = None,
        **kwargs: Any,
    ):
        from langchain_openai import ChatOpenAI

        settings = get_settings()
        client = ChatOpenAI(
            model=model,
            api_key=api_key or settings.qwen_api_key,
            base_url=PROVIDER_BASE_URLS[ModelProvider.QWEN],
            **kwargs,
        )
        super().__init__(client)


class GLMProvider(LangChainProvider):
    """Zhipu AI GLM (智谱) provider (OpenAI-compatible)."""

    def __init__(
        self,
        model: str = "glm-4",
        api_key: str | None = None,
        **kwargs: Any,
    ):
        from langchain_openai import ChatOpenAI

        settings = get_settings()
        client = ChatOpenAI(
            model=model,
            api_key=api_key or settings.glm_api_key,
            base_url=PROVIDER_BASE_URLS[ModelProvider.GLM],
            **kwargs,
        )
        super().__init__(client)


class MoonshotProvider(LangChainProvider):
    """Moonshot (月之暗面/Kimi) provider (OpenAI-compatible)."""

    def __init__(
        self,
        model: str = "moonshot-v1-8k",
        api_key: str | None = None,
        **kwargs: Any,
    ):
        from langchain_openai import ChatOpenAI

        settings = get_settings()
        client = ChatOpenAI(
            model=model,
            api_key=api_key or settings.moonshot_api_key,
            base_url=PROVIDER_BASE_URLS[ModelProvider.MOONSHOT],
            **kwargs,
        )
        super().__init__(client)


class YiProvider(LangChainProvider):
    """01.AI Yi (零一万物) provider (OpenAI-compatible)."""

    def __init__(
        self,
        model: str = "yi-large",
        api_key: str | None = None,
        **kwargs: Any,
    ):
        from langchain_openai import ChatOpenAI

        settings = get_settings()
        client = ChatOpenAI(
            model=model,
            api_key=api_key or settings.yi_api_key,
            base_url=PROVIDER_BASE_URLS[ModelProvider.YI],
            **kwargs,
        )
        super().__init__(client)


class BaichuanProvider(LangChainProvider):
    """Baichuan (百川) provider (OpenAI-compatible)."""

    def __init__(
        self,
        model: str = "Baichuan4",
        api_key: str | None = None,
        **kwargs: Any,
    ):
        from langchain_openai import ChatOpenAI

        settings = get_settings()
        client = ChatOpenAI(
            model=model,
            api_key=api_key or settings.baichuan_api_key,
            base_url=PROVIDER_BASE_URLS[ModelProvider.BAICHUAN],
            **kwargs,
        )
        super().__init__(client)


class MinimaxProvider(LangChainProvider):
    """Minimax provider (OpenAI-compatible)."""

    def __init__(
        self,
        model: str = "abab6.5-chat",
        api_key: str | None = None,
        group_id: str | None = None,
        **kwargs: Any,
    ):
        from langchain_openai import ChatOpenAI

        settings = get_settings()
        # Minimax requires group_id in the URL
        base_url = f"https://api.minimax.chat/v1"
        if group_id or settings.minimax_group_id:
            base_url = f"https://api.minimax.chat/v1"

        client = ChatOpenAI(
            model=model,
            api_key=api_key or settings.minimax_api_key,
            base_url=base_url,
            **kwargs,
        )
        super().__init__(client)


class TogetherProvider(LangChainProvider):
    """Together AI provider (OpenAI-compatible)."""

    def __init__(
        self,
        model: str = "meta-llama/Llama-3-70b-chat-hf",
        api_key: str | None = None,
        **kwargs: Any,
    ):
        from langchain_openai import ChatOpenAI

        settings = get_settings()
        client = ChatOpenAI(
            model=model,
            api_key=api_key or settings.together_api_key,
            base_url=PROVIDER_BASE_URLS[ModelProvider.TOGETHER],
            **kwargs,
        )
        super().__init__(client)


class AWSBedrockProvider(LangChainProvider):
    """AWS Bedrock provider."""

    def __init__(
        self,
        model: str = "anthropic.claude-3-sonnet-20240229-v1:0",
        region: str = "us-east-1",
        **kwargs: Any,
    ):
        from langchain_aws import ChatBedrock

        client = ChatBedrock(
            model_id=model,
            region_name=region,
            **kwargs,
        )
        super().__init__(client)


class AzureOpenAIProvider(LangChainProvider):
    """Azure OpenAI provider."""

    def __init__(
        self,
        model: str = "gpt-4o",
        api_key: str | None = None,
        azure_endpoint: str | None = None,
        api_version: str = "2024-02-15-preview",
        **kwargs: Any,
    ):
        from langchain_openai import AzureChatOpenAI

        settings = get_settings()
        client = AzureChatOpenAI(
            model=model,
            api_key=api_key or settings.azure_openai_api_key,
            azure_endpoint=azure_endpoint or settings.azure_openai_endpoint,
            api_version=api_version,
            **kwargs,
        )
        super().__init__(client)


class ERNIEProvider(LLMProvider):
    """Baidu ERNIE (文心一言) provider using custom API."""

    def __init__(
        self,
        model: str = "ernie-4.0-8k",
        api_key: str | None = None,
        secret_key: str | None = None,
        **kwargs: Any,
    ):
        settings = get_settings()
        self.api_key = api_key or settings.ernie_api_key
        self.secret_key = secret_key or settings.ernie_secret_key
        self.model = model
        self.access_token = None

    async def _get_access_token(self) -> str:
        """Get access token from Baidu."""
        import aiohttp

        url = f"https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id={self.api_key}&client_secret={self.secret_key}"

        async with aiohttp.ClientSession() as session:
            async with session.post(url) as response:
                data = await response.json()
                return data.get("access_token", "")

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> str:
        import aiohttp

        if not self.access_token:
            self.access_token = await self._get_access_token()

        url = f"https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/{self.model}?access_token={self.access_token}"

        payload = {
            "messages": [{"role": "user", "content": prompt}],
        }
        if system_prompt:
            payload["system"] = system_prompt

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                data = await response.json()
                return data.get("result", "")

    async def generate_with_history(
        self,
        messages: list[BaseMessage],
        **kwargs: Any,
    ) -> str:
        import aiohttp

        if not self.access_token:
            self.access_token = await self._get_access_token()

        url = f"https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/{self.model}?access_token={self.access_token}"

        formatted_messages = []
        for msg in messages:
            role = "user" if msg.type == "human" else "assistant"
            formatted_messages.append({"role": role, "content": msg.content})

        payload = {"messages": formatted_messages}

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                data = await response.json()
                return data.get("result", "")


class SparkProvider(LLMProvider):
    """iFlytek Spark (讯飞星火) provider using WebSocket API."""

    def __init__(
        self,
        model: str = "spark-v3.5",
        app_id: str | None = None,
        api_key: str | None = None,
        api_secret: str | None = None,
        **kwargs: Any,
    ):
        settings = get_settings()
        self.app_id = app_id or settings.spark_app_id
        self.api_key = api_key or settings.spark_api_key
        self.api_secret = api_secret or settings.spark_api_secret
        self.model = model

        # Model version to URL mapping
        self.model_urls = {
            "spark-v3.5": "wss://spark-api.xf-yun.com/v3.5/chat",
            "spark-v3.0": "wss://spark-api.xf-yun.com/v3.1/chat",
            "spark-v2.0": "wss://spark-api.xf-yun.com/v2.1/chat",
            "spark-v1.5": "wss://spark-api.xf-yun.com/v1.1/chat",
        }

    def _generate_auth_url(self) -> str:
        """Generate authenticated WebSocket URL."""
        import hmac
        import base64
        from hashlib import sha256
        from urllib.parse import urlencode, urlparse
        import time

        url = self.model_urls.get(self.model, self.model_urls["spark-v3.5"])
        parsed = urlparse(url)

        # Generate authentication
        timestamp = str(int(time.time()))
        signature_origin = f"host: {parsed.netloc}\ndate: {timestamp}\nGET {parsed.path} HTTP/1.1"
        signature_sha = hmac.new(
            self.api_secret.encode(),
            signature_origin.encode(),
            sha256,
        ).digest()
        signature = base64.b64encode(signature_sha).decode()
        authorization_origin = f'api_key="{self.api_key}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature}"'
        authorization = base64.b64encode(authorization_origin.encode()).decode()

        params = {"authorization": authorization, "date": timestamp, "host": parsed.netloc}
        return f"{url}?{urlencode(params)}"

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> str:
        import asyncio
        import json
        import websockets

        auth_url = self._generate_auth_url()

        payload = {
            "header": {"app_id": self.app_id},
            "parameter": {"chat": {"domain": self.model}},
            "payload": {
                "message": {
                    "text": [{"role": "user", "content": prompt}],
                }
            },
        }

        result = []

        async with websockets.connect(auth_url) as ws:
            await ws.send(json.dumps(payload))
            async for message in ws:
                data = json.loads(message)
                if "payload" in data:
                    text = data["payload"]["choices"]["text"]
                    for item in text:
                        result.append(item["content"])
                if data.get("header", {}).get("status") == 2:
                    break

        return "".join(result)

    async def generate_with_history(
        self,
        messages: list[BaseMessage],
        **kwargs: Any,
    ) -> str:
        import json
        import websockets

        auth_url = self._generate_auth_url()

        formatted_messages = []
        for msg in messages:
            role = "user" if msg.type == "human" else "assistant"
            formatted_messages.append({"role": role, "content": msg.content})

        payload = {
            "header": {"app_id": self.app_id},
            "parameter": {"chat": {"domain": self.model}},
            "payload": {"message": {"text": formatted_messages}},
        }

        result = []

        async with websockets.connect(auth_url) as ws:
            await ws.send(json.dumps(payload))
            async for message in ws:
                data = json.loads(message)
                if "payload" in data:
                    text = data["payload"]["choices"]["text"]
                    for item in text:
                        result.append(item["content"])
                if data.get("header", {}).get("status") == 2:
                    break

        return "".join(result)


class DoubaoProvider(LangChainProvider):
    """ByteDance Doubao (豆包) provider via Volcengine (OpenAI-compatible)."""

    def __init__(
        self,
        model: str = "doubao-pro-32k",
        api_key: str | None = None,
        endpoint_id: str | None = None,
        **kwargs: Any,
    ):
        from langchain_openai import ChatOpenAI

        settings = get_settings()
        # Doubao uses Volcengine endpoint
        endpoint = endpoint_id or settings.doubao_endpoint_id
        base_url = f"https://ark.cn-beijing.volces.com/api/v3"

        client = ChatOpenAI(
            model=endpoint or model,  # Endpoint ID is used as model name
            api_key=api_key or settings.doubao_api_key,
            base_url=base_url,
            **kwargs,
        )
        super().__init__(client)


# Provider factory
PROVIDER_CLASSES: dict[ModelProvider, type[LLMProvider]] = {
    ModelProvider.OPENAI: OpenAIProvider,
    ModelProvider.ANTHROPIC: AnthropicProvider,
    ModelProvider.GOOGLE: GoogleProvider,
    ModelProvider.GROQ: GroqProvider,
    ModelProvider.MISTRAL: MistralProvider,
    ModelProvider.COHERE: CohereProvider,
    ModelProvider.DEEPSEEK: DeepSeekProvider,
    ModelProvider.QWEN: QwenProvider,
    ModelProvider.GLM: GLMProvider,
    ModelProvider.MOONSHOT: MoonshotProvider,
    ModelProvider.YI: YiProvider,
    ModelProvider.BAICHUAN: BaichuanProvider,
    ModelProvider.MINIMAX: MinimaxProvider,
    ModelProvider.TOGETHER: TogetherProvider,
    ModelProvider.AWS_BEDROCK: AWSBedrockProvider,
    ModelProvider.AZURE_OPENAI: AzureOpenAIProvider,
    ModelProvider.ERNIE: ERNIEProvider,
    ModelProvider.SPARK: SparkProvider,
    ModelProvider.DOUBAO: DoubaoProvider,
}


def get_llm(
    provider: str | ModelProvider | None = None,
    model: str | None = None,
    **kwargs: Any,
) -> LLMProvider:
    """
    Factory function to get an LLM provider.

    Args:
        provider: Provider name (string or ModelProvider enum)
        model: Model name (optional, uses default if not specified)
        **kwargs: Additional provider-specific arguments

    Returns:
        LLMProvider instance

    Examples:
        # Get default provider (checks available API keys)
        llm = get_llm()

        # Get specific provider
        llm = get_llm("openai", model="gpt-4o")
        llm = get_llm("deepseek", model="deepseek-chat")
        llm = get_llm("qwen", model="qwen-max")

        # Use enum
        llm = get_llm(ModelProvider.ANTHROPIC, model="claude-sonnet-4-20250514")
    """
    settings = get_settings()

    # Auto-detect provider if not specified
    if provider is None:
        provider = _auto_detect_provider()

    # Convert string to enum
    if isinstance(provider, str):
        provider = ModelProvider(provider.lower())

    # Use default model if not specified
    if model is None:
        model = DEFAULT_MODELS.get(provider)

    # Get provider class
    provider_class = PROVIDER_CLASSES.get(provider)
    if provider_class is None:
        raise ValueError(f"Unknown LLM provider: {provider}")

    return provider_class(model=model, **kwargs)


def _auto_detect_provider() -> ModelProvider:
    """Auto-detect the best available provider based on API keys."""
    settings = get_settings()

    # Priority order for auto-detection
    priority_order = [
        (settings.anthropic_api_key, ModelProvider.ANTHROPIC),
        (settings.openai_api_key, ModelProvider.OPENAI),
        (settings.google_api_key, ModelProvider.GOOGLE),
        (settings.deepseek_api_key, ModelProvider.DEEPSEEK),
        (settings.qwen_api_key, ModelProvider.QWEN),
        (settings.glm_api_key, ModelProvider.GLM),
        (settings.moonshot_api_key, ModelProvider.MOONSHOT),
        (settings.groq_api_key, ModelProvider.GROQ),
        (settings.mistral_api_key, ModelProvider.MISTRAL),
        (settings.cohere_api_key, ModelProvider.COHERE),
        (settings.together_api_key, ModelProvider.TOGETHER),
        (settings.ernie_api_key, ModelProvider.ERNIE),
        (settings.spark_api_key, ModelProvider.SPARK),
    ]

    for api_key, provider in priority_order:
        if api_key:
            return provider

    # Default to OpenAI if no keys found (will fail gracefully)
    return ModelProvider.OPENAI


def list_providers() -> list[dict[str, str]]:
    """List all supported providers and their default models."""
    return [
        {
            "provider": p.value,
            "default_model": DEFAULT_MODELS.get(p, "N/A"),
            "base_url": PROVIDER_BASE_URLS.get(p, "N/A"),
        }
        for p in ModelProvider
    ]
