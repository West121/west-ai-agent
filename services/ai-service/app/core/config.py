from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from os import getenv
from typing import Literal

ProviderName = Literal["openai_like", "vllm", "ollama"]


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
    default_provider: ProviderName = "openai_like"
    openai_like_base_url: str | None = None
    openai_like_api_key: str | None = None
    vllm_base_url: str | None = None
    ollama_base_url: str | None = None
    opensearch_url: str | None = None
    opensearch_index: str | None = None
    opensearch_username: str | None = None
    opensearch_password: str | None = None
    openai_like_models: tuple[str, ...] = ("qwen-plus", "qwen-max", "deepseek-v3")
    vllm_models: tuple[str, ...] = ("mixtral", "llama-3.1", "qwen2.5")
    ollama_models: tuple[str, ...] = ("llama3.2", "mistral", "qwen2.5")

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
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
            openai_like_models=_read_models(getenv("AI_SERVICE_OPENAI_LIKE_MODELS"), cls.openai_like_models),
            vllm_models=_read_models(getenv("AI_SERVICE_VLLM_MODELS"), cls.vllm_models),
            ollama_models=_read_models(getenv("AI_SERVICE_OLLAMA_MODELS"), cls.ollama_models),
        )


@lru_cache
def get_settings() -> Settings:
    return Settings.from_env()
