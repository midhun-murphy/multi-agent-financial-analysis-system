"""
backend/config/settings.py
==========================
Central application configuration using Pydantic Settings.

All configuration is loaded from environment variables (or .env file).
This is the single source of truth for all runtime settings.
No configuration should be hard-coded anywhere else in the codebase.

Usage:
    from backend.config.settings import get_settings
    settings = get_settings()
    print(settings.app_name)
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.

    All fields have sensible defaults for local development.
    Override via .env file or environment variables in production.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Application ---------------------------------------------------------
    app_name: str = Field(
        default="Multi-Agent Financial Statement Analysis System",
        description="Human-readable application name.",
    )
    app_version: str = Field(default="1.0.0")
    app_env: Literal["development", "staging", "production"] = Field(
        default="development"
    )
    debug: bool = Field(default=False)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(
        default="INFO"
    )

    # --- Server --------------------------------------------------------------
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000, ge=1, le=65535)
    allowed_origins: str = Field(
        default="http://localhost:8080,http://127.0.0.1:8080"
    )

    @property
    def cors_origins(self) -> list[str]:
        """Parse comma-separated ALLOWED_ORIGINS into a list."""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    # --- LLM Provider --------------------------------------------------------
    llm_provider: Literal["gemini", "openai", "claude"] = Field(default="gemini")
    google_api_key: str = Field(default="")
    gemini_model: str = Field(default="gemini-2.0-flash")
    openai_api_key: str = Field(default="")
    openai_model: str = Field(default="gpt-4o")
    anthropic_api_key: str = Field(default="")
    anthropic_model: str = Field(default="claude-3-5-sonnet-20241022")

    # --- Finance APIs --------------------------------------------------------
    yahoo_finance_enabled: bool = Field(default=True)
    finnhub_api_key: str = Field(default="")
    finnhub_enabled: bool = Field(default=True)
    fmp_api_key: str = Field(default="")
    fmp_enabled: bool = Field(default=True)

    # --- News APIs -----------------------------------------------------------
    newsapi_key: str = Field(default="")
    newsapi_enabled: bool = Field(default=True)
    google_news_enabled: bool = Field(default=True)

    # --- Vector Database -----------------------------------------------------
    chroma_persist_dir: str = Field(default="./storage/chroma")
    chroma_collection_name: str = Field(default="financial_documents")

    # --- Storage -------------------------------------------------------------
    upload_dir: str = Field(default="./storage/uploads")
    reports_dir: str = Field(default="./storage/reports")
    exports_dir: str = Field(default="./storage/exports")
    temp_dir: str = Field(default="./storage/temporary")
    max_upload_size_mb: int = Field(default=50, ge=1, le=500)

    # --- Embedding -----------------------------------------------------------
    embedding_model: str = Field(default="all-MiniLM-L6-v2")

    # --- Analysis Settings ---------------------------------------------------
    analysis_timeout_seconds: int = Field(default=120, ge=10)
    max_concurrent_agents: int = Field(default=5, ge=1, le=20)
    retrieval_top_k: int = Field(default=10, ge=1, le=50)
    bm25_weight: float = Field(default=0.4, ge=0.0, le=1.0)
    vector_weight: float = Field(default=0.6, ge=0.0, le=1.0)

    @field_validator("bm25_weight", "vector_weight", mode="before")
    @classmethod
    def validate_weight(cls, v: float) -> float:
        """Ensure retrieval weights are valid floats."""
        return float(v)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Return the cached application settings singleton.

    Uses lru_cache to ensure only one Settings instance is created
    per process, avoiding repeated .env file reads.

    Returns:
        Settings: The validated application configuration.
    """
    return Settings()
