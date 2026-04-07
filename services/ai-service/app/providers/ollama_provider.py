from __future__ import annotations

from typing import Any

import httpx

from app.core.config import get_settings
from app.providers.base import BaseProvider, ProviderInfo


class OllamaProvider(BaseProvider):
    info = ProviderInfo(name="ollama", models=("llama3.2", "mistral", "qwen2.5"))

    def __init__(self, client: httpx.Client | None = None) -> None:
        self._client = client

    def chat_completions(self, request: dict[str, Any]) -> dict[str, Any]:
        settings = get_settings()
        if not settings.ollama_base_url:
            raise RuntimeError("AI_SERVICE_OLLAMA_BASE_URL is required for ollama provider")

        normalized_model = self._normalize_model_name(request["model"])
        payload: dict[str, Any] = {
            "model": normalized_model,
            "messages": request["messages"],
            "stream": False,
        }
        temperature = request.get("temperature")
        if temperature is not None:
            payload["options"] = {"temperature": temperature}
        client = self._get_client(settings)
        try:
            response = client.post(
                "/api/chat",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            body = response.json()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text.strip() or str(exc)
            raise RuntimeError(f"ollama provider request failed: {detail}") from exc
        except httpx.HTTPError as exc:
            raise RuntimeError(f"ollama provider request failed: {exc}") from exc
        finally:
            if self._client is None:
                client.close()

        prompt_tokens = body.get("prompt_eval_count") or 0
        completion_tokens = body.get("eval_count") or 0
        message = body.get("message") or {"role": "assistant", "content": ""}
        return {
            "provider": self.name,
            "model": body.get("model", normalized_model),
            "choices": [
                {
                    "index": 0,
                    "message": message,
                    "finish_reason": body.get("done_reason", "stop"),
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        }

    def _get_client(self, settings) -> httpx.Client:
        if self._client is not None:
            return self._client
        base_url = settings.ollama_base_url.rstrip("/")
        return httpx.Client(base_url=base_url, timeout=30.0)

    def _normalize_model_name(self, model: str) -> str:
        if model.startswith(f"{self.name}:"):
            return model.split(":", 1)[1]
        return model
