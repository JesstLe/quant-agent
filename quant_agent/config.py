"""Configuration management using Pydantic Settings."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ============================================================
    # Environment
    # ============================================================
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    log_level: str = "INFO"

    # ============================================================
    # International LLM Providers
    # ============================================================

    # OpenAI
    openai_api_key: str = ""
    openai_org_id: str = ""
    openai_base_url: str = ""

    # Anthropic
    anthropic_api_key: str = ""

    # Google (Gemini)
    google_api_key: str = ""

    # AWS Bedrock
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"

    # Azure OpenAI
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    azure_openai_api_version: str = "2024-02-15-preview"

    # Groq
    groq_api_key: str = ""

    # Cohere
    cohere_api_key: str = ""

    # Mistral
    mistral_api_key: str = ""

    # Together AI
    together_api_key: str = ""

    # Replicate
    replicate_api_key: str = ""

    # ============================================================
    # Chinese LLM Providers
    # ============================================================

    # DeepSeek
    deepseek_api_key: str = ""

    # Alibaba Qwen (通义千问)
    qwen_api_key: str = ""

    # Baidu ERNIE (文心一言)
    ernie_api_key: str = ""
    ernie_secret_key: str = ""

    # Zhipu AI GLM (智谱)
    glm_api_key: str = ""

    # Moonshot (月之暗面/Kimi)
    moonshot_api_key: str = ""

    # iFlytek Spark (讯飞星火)
    spark_app_id: str = ""
    spark_api_key: str = ""
    spark_api_secret: str = ""

    # ByteDance Doubao (豆包)
    doubao_api_key: str = ""
    doubao_endpoint_id: str = ""

    # 01.AI Yi (零一万物)
    yi_api_key: str = ""

    # Baichuan (百川)
    baichuan_api_key: str = ""

    # Minimax
    minimax_api_key: str = ""
    minimax_group_id: str = ""

    # SenseTime SenseNova (商汤)
    sensenova_api_key: str = ""

    # ============================================================
    # Data Sources
    # ============================================================
    alpha_vantage_api_key: str = ""
    polygon_api_key: str = ""

    # ============================================================
    # Trading APIs
    # ============================================================
    alpaca_api_key: str = ""
    alpaca_secret_key: str = ""
    binance_api_key: str = ""
    binance_secret_key: str = ""

    # ============================================================
    # Database
    # ============================================================
    database_url: str = "sqlite+aiosqlite:///./data/quantagent.db"
    redis_url: str = "redis://localhost:6379/0"

    # ============================================================
    # Risk Management
    # ============================================================
    max_position_size: float = Field(default=0.1, ge=0.01, le=1.0)
    max_daily_loss: float = Field(default=0.02, ge=0.01, le=0.1)
    risk_free_rate: float = Field(default=0.04, ge=0.0, le=0.1)

    # ============================================================
    # Trading
    # ============================================================
    paper_trading: bool = True
    default_capital: float = 100000.0
    default_llm: str = "claude-sonnet-4-20250514"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
