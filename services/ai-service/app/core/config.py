from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from os import getenv
from typing import Literal

ProviderName = Literal["openai_like", "vllm", "ollama"]
DEFAULT_APP_NAME = "ai-service"
DEFAULT_APP_ENV = "development"
DEFAULT_APP_HOST = "0.0.0.0"
DEFAULT_APP_PORT = 8020
DEFAULT_APP_CORS_ORIGINS = ("*",)
DEFAULT_OPENAI_LIKE_MODELS = ("qwen-plus", "qwen-max", "deepseek-v3")
DEFAULT_VLLM_MODELS = ("mixtral", "llama-3.1", "qwen2.5")
DEFAULT_OLLAMA_MODELS = ("llama3.2", "mistral", "qwen2.5")


def _read_provider_name(value: str | None) -> ProviderName:
    normalized = (value or "openai_like").strip().lower()
    if normalized not in {"openai_like", "vllm", "ollama"}:
        return "openai_like"
    return normalized  # type: ignore[return-value]


def _read_optional(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _read_models(value: str | None, fallback: tuple[str, ...]) -> tuple[str, ...]:
    if value is None:
        return fallback
    models = tuple(item.strip() for item in value.split(",") if item.strip())
    return models or fallback


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str = DEFAULT_APP_NAME
    app_env: str = DEFAULT_APP_ENV
    app_host: str = DEFAULT_APP_HOST
    app_port: int = DEFAULT_APP_PORT
    app_cors_origins: tuple[str, ...] = DEFAULT_APP_CORS_ORIGINS
    default_provider: ProviderName = "openai_like"
    openai_like_base_url: str | None = None
    openai_like_api_key: str | None = None
    vllm_base_url: str | None = None
    ollama_base_url: str | None = None
    opensearch_url: str | None = None
    opensearch_index: str | None = None
    opensearch_username: str | None = None
    opensearch_password: str | None = None
    openai_like_models: tuple[str, ...] = DEFAULT_OPENAI_LIKE_MODELS
    vllm_models: tuple[str, ...] = DEFAULT_VLLM_MODELS
    ollama_models: tuple[str, ...] = DEFAULT_OLLAMA_MODELS

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            app_name=_read_optional(getenv("APP_NAME")) or DEFAULT_APP_NAME,
            app_env=_read_optional(getenv("APP_ENV")) or DEFAULT_APP_ENV,
            app_host=_read_optional(getenv("APP_AI_HOST")) or DEFAULT_APP_HOST,
            app_port=int(_read_optional(getenv("APP_AI_PORT")) or str(DEFAULT_APP_PORT)),
            app_cors_origins=_read_models(getenv("APP_CORS_ORIGINS"), DEFAULT_APP_CORS_ORIGINS),
            default_provider=_read_provider_name(getenv("AI_SERVICE_DEFAULT_PROVIDER")),
            openai_like_base_url=_read_optional(getenv("AI_SERVICE_OPENAI_LIKE_BASE_URL")),
            openai_like_api_key=_read_optional(
                getenv("AI_SERVICE_OPENAI_LIKE_API_KEY") or getenv("QWEN_API_KEY") or getenv("OPENAI_API_KEY")
            ),
            vllm_base_url=_read_optional(getenv("AI_SERVICE_VLLM_BASE_URL")),
            ollama_base_url=_read_optional(getenv("AI_SERVICE_OLLAMA_BASE_URL")),
            opensearch_url=_read_optional(getenv("AI_SERVICE_OPENSEARCH_URL")),
            opensearch_index=_read_optional(getenv("AI_SERVICE_OPENSEARCH_INDEX")),
            opensearch_username=_read_optional(getenv("AI_SERVICE_OPENSEARCH_USERNAME")),
            opensearch_password=_read_optional(getenv("AI_SERVICE_OPENSEARCH_PASSWORD")),
            openai_like_models=_read_models(getenv("AI_SERVICE_OPENAI_LIKE_MODELS"), DEFAULT_OPENAI_LIKE_MODELS),
            vllm_models=_read_models(getenv("AI_SERVICE_VLLM_MODELS"), DEFAULT_VLLM_MODELS),
            ollama_models=_read_models(getenv("AI_SERVICE_OLLAMA_MODELS"), DEFAULT_OLLAMA_MODELS),
        )

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    def validate(self) -> None:
        if not self.is_production:
            return

        if self.app_cors_origins == ("*",):
            raise RuntimeError("APP_CORS_ORIGINS must be restricted in production for ai-service.")

        if self.default_provider == "openai_like":
            if not self.openai_like_base_url:
                raise RuntimeError("AI_SERVICE_OPENAI_LIKE_BASE_URL is required for openai_like provider.")
            if not self.openai_like_api_key:
                raise RuntimeError("AI_SERVICE_OPENAI_LIKE_API_KEY or QWEN_API_KEY is required for openai_like provider.")

        if self.default_provider == "vllm" and not self.vllm_base_url:
            raise RuntimeError("AI_SERVICE_VLLM_BASE_URL is required for vllm provider.")

        if self.default_provider == "ollama" and not self.ollama_base_url:
            raise RuntimeError("AI_SERVICE_OLLAMA_BASE_URL is required for ollama provider.")


@lru_cache
def get_settings() -> Settings:
    return Settings.from_env()
