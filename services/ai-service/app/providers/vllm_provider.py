from __future__ import annotations

from typing import Any

import httpx

from app.core.config import get_settings
from app.providers.base import BaseProvider, ProviderInfo


class VLLMProvider(BaseProvider):
    info = ProviderInfo(name="vllm", models=("mixtral", "llama-3.1", "qwen2.5"))

    def __init__(self, client: httpx.Client | None = None) -> None:
        self._client = client

    def chat_completions(self, request: dict[str, Any]) -> dict[str, Any]:
        settings = get_settings()
        if not settings.vllm_base_url:
            raise RuntimeError("AI_SERVICE_VLLM_BASE_URL is required for vllm provider")

        normalized_model = self._normalize_model_name(request["model"])
        payload = {
            "model": normalized_model,
            "messages": request["messages"],
            "stream": False,
        }
        temperature = request.get("temperature")
        if temperature is not None:
            payload["temperature"] = temperature
        client = self._get_client(settings)
        try:
            response = client.post(
                "/chat/completions",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            body = response.json()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text.strip() or str(exc)
            raise RuntimeError(f"vllm provider request failed: {detail}") from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(f"vllm provider request failed: {exc}") from exc
        finally:
            if self._client is None:
                client.close()
        return {
            "provider": self.name,
            "model": body.get("model", normalized_model),
            "choices": body.get("choices", []),
            "usage": body.get("usage"),
        }

    def _get_client(self, settings) -> httpx.Client:
        if self._client is not None:
            return self._client
        base_url = settings.vllm_base_url.rstrip("/")
        return httpx.Client(base_url=base_url, timeout=30.0)

    def _normalize_model_name(self, model: str) -> str:
        if model.startswith(f"{self.name}:"):
            return model.split(":", 1)[1]
        return model
