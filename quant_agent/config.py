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

    # Environment
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    log_level: str = "INFO"

    # LLM Configuration
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    deepseek_api_key: str = ""
    default_llm: str = "claude-sonnet-4.6"

    # Data Sources
    alpha_vantage_api_key: str = ""
    polygon_api_key: str = ""

    # Trading APIs
    alpaca_api_key: str = ""
    alpaca_secret_key: str = ""
    binance_api_key: str = ""
    binance_secret_key: str = ""

    # Database
    database_url: str = "sqlite+aiosqlite:///./data/quantagent.db"
    redis_url: str = "redis://localhost:6379/0"

    # Risk Management
    max_position_size: float = Field(default=0.1, ge=0.01, le=1.0)
    max_daily_loss: float = Field(default=0.02, ge=0.01, le=0.1)
    risk_free_rate: float = Field(default=0.04, ge=0.0, le=0.1)

    # Trading
    paper_trading: bool = True
    default_capital: float = 100000.0

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
