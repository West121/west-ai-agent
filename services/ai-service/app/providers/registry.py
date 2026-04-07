from __future__ import annotations

from dataclasses import dataclass

from app.core.config import Settings, get_settings
from app.providers.base import BaseProvider
from app.providers.ollama_provider import OllamaProvider
from app.providers.openai_like_provider import OpenAILikeProvider
from app.providers.vllm_provider import VLLMProvider


@dataclass(frozen=True, slots=True)
class ProviderEntry:
    provider: BaseProvider
    is_default: bool
    base_url: str | None = None


def build_provider_registry(settings: Settings | None = None) -> dict[str, ProviderEntry]:
    resolved_settings = settings or get_settings()
    providers: tuple[tuple[BaseProvider, str | None], ...] = (
        (OpenAILikeProvider(), resolved_settings.openai_like_base_url),
        (VLLMProvider(), resolved_settings.vllm_base_url),
        (OllamaProvider(), resolved_settings.ollama_base_url),
    )
    return {
        provider.name: ProviderEntry(
            provider=provider,
            is_default=provider.name == resolved_settings.default_provider,
            base_url=base_url,
        )
        for provider, base_url in providers
    }

