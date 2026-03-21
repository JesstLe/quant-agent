"""
Model registry for easy access to supported LLM models.

Usage:
    from quant_agent.models import MODELS, get_model_info

    # List all supported models
    for model in MODELS:
        print(f"{model['provider']}: {model['name']}")

    # Get specific model info
    info = get_model_info("deepseek-chat")
"""

from dataclasses import dataclass
from typing import Any


@dataclass
class ModelInfo:
    """Information about a specific model."""

    provider: str
    name: str
    display_name: str
    context_length: int
    max_output_tokens: int
    supports_vision: bool = False
    supports_function_calling: bool = True
    supports_streaming: bool = True
    cost_input_per_1m: float = 0.0  # USD per 1M tokens
    cost_output_per_1m: float = 0.0
    description: str = ""
    recommended_for: list[str] | None = None


# Registry of all supported models
MODELS: list[ModelInfo] = [
    # ============================================================
    # OpenAI Models
    # ============================================================
    ModelInfo(
        provider="openai",
        name="gpt-4o",
        display_name="GPT-4o",
        context_length=128000,
        max_output_tokens=16384,
        supports_vision=True,
        cost_input_per_1m=2.50,
        cost_output_per_1m=10.00,
        description="Most capable GPT-4 model, optimized for speed and quality",
        recommended_for=["complex_analysis", "strategy_generation", "multi_step_reasoning"],
    ),
    ModelInfo(
        provider="openai",
        name="gpt-4o-mini",
        display_name="GPT-4o Mini",
        context_length=128000,
        max_output_tokens=16384,
        supports_vision=True,
        cost_input_per_1m=0.15,
        cost_output_per_1m=0.60,
        description="Fast and affordable for most tasks",
        recommended_for=["quick_analysis", "sentiment", "simple_signals"],
    ),
    ModelInfo(
        provider="openai",
        name="o1",
        display_name="O1",
        context_length=200000,
        max_output_tokens=100000,
        supports_vision=False,
        supports_function_calling=False,
        cost_input_per_1m=15.00,
        cost_output_per_1m=60.00,
        description="Advanced reasoning model for complex problems",
        recommended_for=["deep_research", "complex_strategy_design"],
    ),

    # ============================================================
    # Anthropic Models
    # ============================================================
    ModelInfo(
        provider="anthropic",
        name="claude-sonnet-4-20250514",
        display_name="Claude Sonnet 4",
        context_length=200000,
        max_output_tokens=16000,
        supports_vision=True,
        cost_input_per_1m=3.00,
        cost_output_per_1m=15.00,
        description="Best balance of intelligence and speed",
        recommended_for=["trading_analysis", "strategy_development", "risk_assessment"],
    ),
    ModelInfo(
        provider="anthropic",
        name="claude-opus-4-20250514",
        display_name="Claude Opus 4",
        context_length=200000,
        max_output_tokens=32000,
        supports_vision=True,
        cost_input_per_1m=15.00,
        cost_output_per_1m=75.00,
        description="Most intelligent Claude model for complex tasks",
        recommended_for=["deep_research", "complex_strategy", "multi_asset_analysis"],
    ),
    ModelInfo(
        provider="anthropic",
        name="claude-3-5-haiku-20241022",
        display_name="Claude 3.5 Haiku",
        context_length=200000,
        max_output_tokens=8192,
        supports_vision=True,
        cost_input_per_1m=0.80,
        cost_output_per_1m=4.00,
        description="Fastest Claude model for high-volume tasks",
        recommended_for=["quick_signals", "real_time_analysis", "high_frequency"],
    ),

    # ============================================================
    # Google Models
    # ============================================================
    ModelInfo(
        provider="google",
        name="gemini-2.0-flash",
        display_name="Gemini 2.0 Flash",
        context_length=1000000,
        max_output_tokens=8192,
        supports_vision=True,
        cost_input_per_1m=0.10,
        cost_output_per_1m=0.40,
        description="Fast and efficient with 1M context",
        recommended_for=["large_context", "quick_analysis"],
    ),
    ModelInfo(
        provider="google",
        name="gemini-1.5-pro",
        display_name="Gemini 1.5 Pro",
        context_length=2000000,
        max_output_tokens=8192,
        supports_vision=True,
        cost_input_per_1m=1.25,
        cost_output_per_1m=5.00,
        description="2M context window for massive document analysis",
        recommended_for=["large_context", "historical_analysis"],
    ),

    # ============================================================
    # Groq Models (Fast Inference)
    # ============================================================
    ModelInfo(
        provider="groq",
        name="llama-3.3-70b-versatile",
        display_name="Llama 3.3 70B (Groq)",
        context_length=128000,
        max_output_tokens=8192,
        cost_input_per_1m=0.59,
        cost_output_per_1m=0.79,
        description="Ultra-fast inference with Llama 3.3",
        recommended_for=["real_time", "high_frequency", "low_latency"],
    ),
    ModelInfo(
        provider="groq",
        name="deepseek-r1-distill-llama-70b",
        display_name="DeepSeek R1 Distill (Groq)",
        context_length=131072,
        max_output_tokens=8192,
        cost_input_per_1m=0.75,
        cost_output_per_1m=0.99,
        description="DeepSeek reasoning model with fast inference",
        recommended_for=["reasoning", "analysis"],
    ),

    # ============================================================
    # DeepSeek Models
    # ============================================================
    ModelInfo(
        provider="deepseek",
        name="deepseek-chat",
        display_name="DeepSeek Chat",
        context_length=64000,
        max_output_tokens=4096,
        cost_input_per_1m=0.14,
        cost_output_per_1m=0.28,
        description="Cost-effective Chinese/English bilingual model",
        recommended_for=["general_analysis", "cost_effective"],
    ),
    ModelInfo(
        provider="deepseek",
        name="deepseek-reasoner",
        display_name="DeepSeek Reasoner (R1)",
        context_length=64000,
        max_output_tokens=8192,
        cost_input_per_1m=0.55,
        cost_output_per_1m=2.19,
        description="Advanced reasoning model for complex analysis",
        recommended_for=["deep_analysis", "strategy_design"],
    ),

    # ============================================================
    # Alibaba Qwen Models (通义千问)
    # ============================================================
    ModelInfo(
        provider="qwen",
        name="qwen-max",
        display_name="Qwen Max",
        context_length=32000,
        max_output_tokens=8192,
        cost_input_per_1m=2.00,
        cost_output_per_1m=6.00,
        description="Most capable Qwen model",
        recommended_for=["chinese_analysis", "complex_tasks"],
    ),
    ModelInfo(
        provider="qwen",
        name="qwen-plus",
        display_name="Qwen Plus",
        context_length=128000,
        max_output_tokens=6144,
        cost_input_per_1m=0.40,
        cost_output_per_1m=2.00,
        description="Balanced performance and cost",
        recommended_for=["general_use", "balanced"],
    ),
    ModelInfo(
        provider="qwen",
        name="qwen-turbo",
        display_name="Qwen Turbo",
        context_length=128000,
        max_output_tokens=6144,
        cost_input_per_1m=0.05,
        cost_output_per_1m=0.20,
        description="Fast and affordable",
        recommended_for=["high_volume", "cost_effective"],
    ),
    ModelInfo(
        provider="qwen",
        name="qwen-vl-max",
        display_name="Qwen VL Max",
        context_length=32000,
        max_output_tokens=8192,
        supports_vision=True,
        cost_input_per_1m=2.00,
        cost_output_per_1m=6.00,
        description="Vision model for chart analysis",
        recommended_for=["chart_analysis", "image_understanding"],
    ),

    # ============================================================
    # Zhipu AI GLM Models (智谱AI)
    # ============================================================
    ModelInfo(
        provider="glm",
        name="glm-4",
        display_name="GLM-4",
        context_length=128000,
        max_output_tokens=4096,
        cost_input_per_1m=14.00,
        cost_output_per_1m=14.00,
        description="Most capable GLM model",
        recommended_for=["complex_analysis", "chinese_tasks"],
    ),
    ModelInfo(
        provider="glm",
        name="glm-4-flash",
        display_name="GLM-4 Flash",
        context_length=128000,
        max_output_tokens=4096,
        cost_input_per_1m=0.10,
        cost_output_per_1m=0.10,
        description="Fast GLM model",
        recommended_for=["quick_analysis", "high_volume"],
    ),
    ModelInfo(
        provider="glm",
        name="glm-4v",
        display_name="GLM-4V",
        context_length=8192,
        max_output_tokens=1024,
        supports_vision=True,
        cost_input_per_1m=14.00,
        cost_output_per_1m=14.00,
        description="Vision model for image analysis",
        recommended_for=["chart_reading", "image_analysis"],
    ),

    # ============================================================
    # Moonshot Models (月之暗面/Kimi)
    # ============================================================
    ModelInfo(
        provider="moonshot",
        name="moonshot-v1-8k",
        display_name="Moonshot V1 8K",
        context_length=8192,
        max_output_tokens=4096,
        cost_input_per_1m=12.00,
        cost_output_per_1m=12.00,
        description="Kimi AI model",
        recommended_for=["general_use"],
    ),
    ModelInfo(
        provider="moonshot",
        name="moonshot-v1-32k",
        display_name="Moonshot V1 32K",
        context_length=32768,
        max_output_tokens=4096,
        cost_input_per_1m=24.00,
        cost_output_per_1m=24.00,
        description="Kimi with longer context",
        recommended_for=["long_context"],
    ),
    ModelInfo(
        provider="moonshot",
        name="moonshot-v1-128k",
        display_name="Moonshot V1 128K",
        context_length=131072,
        max_output_tokens=4096,
        cost_input_per_1m=60.00,
        cost_output_per_1m=60.00,
        description="Kimi with very long context",
        recommended_for=["very_long_context", "document_analysis"],
    ),

    # ============================================================
    # 01.AI Yi Models (零一万物)
    # ============================================================
    ModelInfo(
        provider="yi",
        name="yi-large",
        display_name="Yi Large",
        context_length=32768,
        max_output_tokens=4096,
        cost_input_per_1m=12.00,
        cost_output_per_1m=12.00,
        description="Large Yi model",
        recommended_for=["complex_tasks", "chinese_analysis"],
    ),
    ModelInfo(
        provider="yi",
        name="yi-medium",
        display_name="Yi Medium",
        context_length=16384,
        max_output_tokens=4096,
        cost_input_per_1m=2.50,
        cost_output_per_1m=2.50,
        description="Balanced Yi model",
        recommended_for=["general_use", "balanced"],
    ),
    ModelInfo(
        provider="yi",
        name="yi-vision",
        display_name="Yi Vision",
        context_length=16384,
        max_output_tokens=4096,
        supports_vision=True,
        cost_input_per_1m=6.00,
        cost_output_per_1m=6.00,
        description="Vision model for image analysis",
        recommended_for=["chart_analysis"],
    ),

    # ============================================================
    # Mistral Models
    # ============================================================
    ModelInfo(
        provider="mistral",
        name="mistral-large-latest",
        display_name="Mistral Large",
        context_length=128000,
        max_output_tokens=8192,
        cost_input_per_1m=2.00,
        cost_output_per_1m=6.00,
        description="Most capable Mistral model",
        recommended_for=["complex_analysis"],
    ),
    ModelInfo(
        provider="mistral",
        name="mistral-small-latest",
        display_name="Mistral Small",
        context_length=128000,
        max_output_tokens=8192,
        cost_input_per_1m=0.20,
        cost_output_per_1m=0.60,
        description="Fast Mistral model",
        recommended_for=["quick_analysis", "cost_effective"],
    ),

    # ============================================================
    # Cohere Models
    # ============================================================
    ModelInfo(
        provider="cohere",
        name="command-r-plus",
        display_name="Command R+",
        context_length=128000,
        max_output_tokens=4096,
        cost_input_per_1m=3.00,
        cost_output_per_1m=15.00,
        description="RAG-optimized model",
        recommended_for=["rag", "document_search"],
    ),

    # ============================================================
    # Together AI Models
    # ============================================================
    ModelInfo(
        provider="together",
        name="meta-llama/Llama-3-70b-chat-hf",
        display_name="Llama 3 70B (Together)",
        context_length=8192,
        max_output_tokens=4096,
        cost_input_per_1m=0.80,
        cost_output_per_1m=0.80,
        description="Open source Llama 3",
        recommended_for=["open_source", "cost_effective"],
    ),
    ModelInfo(
        provider="together",
        name="Qwen/Qwen2-72B-Instruct",
        display_name="Qwen2 72B (Together)",
        context_length=32768,
        max_output_tokens=4096,
        cost_input_per_1m=0.80,
        cost_output_per_1m=0.80,
        description="Qwen2 on Together",
        recommended_for=["open_source_qwen"],
    ),

    # ============================================================
    # Baidu ERNIE Models (文心一言)
    # ============================================================
    ModelInfo(
        provider="ernie",
        name="ernie-4.0-8k",
        display_name="ERNIE 4.0 8K",
        context_length=8192,
        max_output_tokens=2048,
        cost_input_per_1m=30.00,
        cost_output_per_1m=60.00,
        description="Most capable ERNIE model",
        recommended_for=["chinese_analysis", "baidu_ecosystem"],
    ),
    ModelInfo(
        provider="ernie",
        name="ernie-3.5-8k",
        display_name="ERNIE 3.5 8K",
        context_length=8192,
        max_output_tokens=2048,
        cost_input_per_1m=4.00,
        cost_output_per_1m=8.00,
        description="Balanced ERNIE model",
        recommended_for=["general_use", "balanced"],
    ),

    # ============================================================
    # iFlytek Spark Models (讯飞星火)
    # ============================================================
    ModelInfo(
        provider="spark",
        name="spark-v3.5",
        display_name="Spark V3.5",
        context_length=8192,
        max_output_tokens=4096,
        cost_input_per_1m=6.00,
        cost_output_per_1m=6.00,
        description="Latest Spark model",
        recommended_for=["chinese_analysis", "voice_integration"],
    ),

    # ============================================================
    # ByteDance Doubao Models (豆包)
    # ============================================================
    ModelInfo(
        provider="doubao",
        name="doubao-pro-32k",
        display_name="Doubao Pro 32K",
        context_length=32768,
        max_output_tokens=4096,
        cost_input_per_1m=0.80,
        cost_output_per_1m=2.00,
        description="Doubao professional model",
        recommended_for=["general_use", "cost_effective"],
    ),
    ModelInfo(
        provider="doubao",
        name="doubao-lite-32k",
        display_name="Doubao Lite 32K",
        context_length=32768,
        max_output_tokens=4096,
        cost_input_per_1m=0.30,
        cost_output_per_1m=0.60,
        description="Lightweight Doubao model",
        recommended_for=["high_volume", "cost_effective"],
    ),

    # ============================================================
    # Baichuan Models (百川)
    # ============================================================
    ModelInfo(
        provider="baichuan",
        name="Baichuan4",
        display_name="Baichuan 4",
        context_length=32768,
        max_output_tokens=4096,
        cost_input_per_1m=12.00,
        cost_output_per_1m=12.00,
        description="Latest Baichuan model",
        recommended_for=["chinese_analysis"],
    ),

    # ============================================================
    # Minimax Models
    # ============================================================
    ModelInfo(
        provider="minimax",
        name="abab6.5-chat",
        display_name="ABAB 6.5",
        context_length=245000,
        max_output_tokens=16384,
        cost_input_per_1m=15.00,
        cost_output_per_1m=15.00,
        description="Minimax large model",
        recommended_for=["long_context", "complex_tasks"],
    ),
]


def get_model_info(model_name: str) -> ModelInfo | None:
    """Get information about a specific model."""
    for model in MODELS:
        if model.name == model_name:
            return model
    return None


def get_models_by_provider(provider: str) -> list[ModelInfo]:
    """Get all models for a specific provider."""
    return [m for m in MODELS if m.provider == provider]


def get_recommended_models(task: str) -> list[ModelInfo]:
    """Get models recommended for a specific task."""
    return [m for m in MODELS if m.recommended_for and task in m.recommended_for]


def list_all_models() -> list[dict[str, Any]]:
    """List all available models as dictionaries."""
    return [
        {
            "provider": m.provider,
            "name": m.name,
            "display_name": m.display_name,
            "context_length": m.context_length,
            "supports_vision": m.supports_vision,
            "cost_input_per_1m": m.cost_input_per_1m,
            "cost_output_per_1m": m.cost_output_per_1m,
        }
        for m in MODELS
    ]
