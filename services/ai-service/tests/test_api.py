from __future__ import annotations

import importlib

import httpx
from fastapi.testclient import TestClient


def build_client_with_env(monkeypatch, **env: str) -> TestClient:
    for key, value in env.items():
        monkeypatch.setenv(key, value)

    config_module = importlib.import_module("app.core.config")
    registry_module = importlib.import_module("app.providers.registry")
    openai_provider_module = importlib.import_module("app.providers.openai_like_provider")
    vllm_provider_module = importlib.import_module("app.providers.vllm_provider")
    ollama_provider_module = importlib.import_module("app.providers.ollama_provider")
    router_module = importlib.import_module("app.api.router")
    main_module = importlib.import_module("app.main")

    config_module.get_settings.cache_clear()
    importlib.reload(config_module)
    importlib.reload(openai_provider_module)
    importlib.reload(vllm_provider_module)
    importlib.reload(ollama_provider_module)
    importlib.reload(registry_module)
    importlib.reload(router_module)
    importlib.reload(main_module)
    return TestClient(main_module.app)


def install_mock_httpx_client(monkeypatch, handler) -> None:
    transport = httpx.MockTransport(handler)
    original_client_class = httpx.Client

    def build_mock_client(*args, **kwargs):
        kwargs["transport"] = transport
        return original_client_class(*args, **kwargs)

    monkeypatch.setattr(httpx, "Client", build_mock_client)


def test_providers_exposes_configured_default_provider(monkeypatch) -> None:
    client = build_client_with_env(monkeypatch, AI_SERVICE_DEFAULT_PROVIDER="ollama")

    response = client.get("/providers")

    assert response.status_code == 200
    body = response.json()
    assert body["default_provider"] == "ollama"
    providers = {provider["name"]: provider for provider in body["providers"]}
    assert providers["ollama"]["is_default"] is True
    assert providers["openai_like"]["is_default"] is False


def test_chat_completions_uses_configured_default_provider(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = request.read().decode()
        return httpx.Response(
            200,
            json={
                "model": "llama3.2",
                "message": {"role": "assistant", "content": "来自 Ollama 的真实响应"},
                "done": True,
                "done_reason": "stop",
                "prompt_eval_count": 9,
                "eval_count": 5,
            },
        )

    install_mock_httpx_client(monkeypatch, handler)
    client = build_client_with_env(
        monkeypatch,
        AI_SERVICE_DEFAULT_PROVIDER="ollama",
        AI_SERVICE_OLLAMA_BASE_URL="http://ollama.invalid",
    )

    response = client.post(
        "/chat/completions",
        json={
            "model": "llama3.2",
            "messages": [{"role": "user", "content": "hello"}],
            "temperature": 0.3,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "ollama"
    assert body["model"] == "llama3.2"
    assert body["choices"][0]["message"]["content"] == "来自 Ollama 的真实响应"
    assert body["usage"] == {"prompt_tokens": 9, "completion_tokens": 5, "total_tokens": 14}
    assert captured["url"] == "http://ollama.invalid/api/chat"
    assert "\"model\":\"llama3.2\"" in str(captured["body"])
    assert "\"temperature\":0.3" in str(captured["body"])


def test_chat_completions_calls_openai_compatible_provider(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("Authorization")
        captured["body"] = request.read().decode()
        return httpx.Response(
            200,
            json={
                "id": "chatcmpl-test",
                "model": "qwen-plus",
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": "真实 Qwen 响应"},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 11, "completion_tokens": 7, "total_tokens": 18},
            },
        )

    install_mock_httpx_client(monkeypatch, handler)
    client = build_client_with_env(
        monkeypatch,
        AI_SERVICE_DEFAULT_PROVIDER="openai_like",
        AI_SERVICE_OPENAI_LIKE_BASE_URL="https://example.invalid/v1",
        AI_SERVICE_OPENAI_LIKE_API_KEY="test-key",
    )

    response = client.post(
        "/chat/completions",
        json={
            "model": "openai_like:qwen-plus",
            "messages": [{"role": "user", "content": "hello"}],
            "temperature": 0.2,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "openai_like"
    assert body["choices"][0]["message"]["content"] == "真实 Qwen 响应"
    assert body["usage"]["total_tokens"] == 18
    assert body["model"] == "qwen-plus"
    assert captured["url"] == "https://example.invalid/v1/chat/completions"
    assert captured["auth"] == "Bearer test-key"
    assert "\"model\":\"qwen-plus\"" in str(captured["body"])


def test_chat_completions_accepts_openai_api_key_fallback(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers.get("Authorization")
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": "fallback key worked"},
                        "finish_reason": "stop",
                    }
                ]
            },
        )

    install_mock_httpx_client(monkeypatch, handler)
    client = build_client_with_env(
        monkeypatch,
        AI_SERVICE_DEFAULT_PROVIDER="openai_like",
        AI_SERVICE_OPENAI_LIKE_BASE_URL="https://example.invalid/v1",
        OPENAI_API_KEY="openai-fallback-key",
    )

    response = client.post(
        "/chat/completions",
        json={
            "model": "qwen-plus",
            "messages": [{"role": "user", "content": "hello"}],
        },
    )

    assert response.status_code == 200
    assert response.json()["choices"][0]["message"]["content"] == "fallback key worked"
    assert captured["auth"] == "Bearer openai-fallback-key"


def test_chat_completions_routes_to_explicit_provider(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = request.read().decode()
        return httpx.Response(
            200,
            json={
                "model": "mistral",
                "message": {"role": "assistant", "content": "显式路由到 Ollama"},
                "done": True,
                "done_reason": "stop",
            },
        )

    install_mock_httpx_client(monkeypatch, handler)
    client = build_client_with_env(monkeypatch, AI_SERVICE_OLLAMA_BASE_URL="http://ollama.invalid")

    response = client.post(
        "/chat/completions",
        json={
            "model": "mistral",
            "provider": "ollama",
            "messages": [{"role": "user", "content": "hello"}],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "ollama"
    assert body["model"] == "mistral"
    assert body["choices"][0]["message"]["content"] == "显式路由到 Ollama"
    assert captured["url"] == "http://ollama.invalid/api/chat"
    assert "\"model\":\"mistral\"" in str(captured["body"])


def test_chat_completions_infers_provider_from_model_prefix(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = request.read().decode()
        return httpx.Response(
            200,
            json={
                "model": "mixtral",
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": "来自 vLLM 的真实响应"},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 7, "completion_tokens": 6, "total_tokens": 13},
            },
        )

    install_mock_httpx_client(monkeypatch, handler)
    client = build_client_with_env(monkeypatch, AI_SERVICE_VLLM_BASE_URL="http://vllm.invalid/v1")

    response = client.post(
        "/chat/completions",
        json={
            "model": "vllm:mixtral",
            "messages": [{"role": "user", "content": "hello"}],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "vllm"
    assert body["model"] == "mixtral"
    assert body["choices"][0]["message"]["content"] == "来自 vLLM 的真实响应"
    assert body["usage"]["total_tokens"] == 13
    assert captured["url"] == "http://vllm.invalid/v1/chat/completions"
    assert "\"model\":\"mixtral\"" in str(captured["body"])


def test_chat_completions_returns_502_when_vllm_base_url_missing(monkeypatch) -> None:
    client = build_client_with_env(monkeypatch, AI_SERVICE_DEFAULT_PROVIDER="openai_like")

    response = client.post(
        "/chat/completions",
        json={
            "model": "vllm:mixtral",
            "messages": [{"role": "user", "content": "hello"}],
        },
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "AI_SERVICE_VLLM_BASE_URL is required for vllm provider"


def test_chat_completions_returns_502_when_ollama_request_fails(monkeypatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="ollama upstream error")

    install_mock_httpx_client(monkeypatch, handler)
    client = build_client_with_env(monkeypatch, AI_SERVICE_OLLAMA_BASE_URL="http://ollama.invalid")

    response = client.post(
        "/chat/completions",
        json={
            "model": "mistral",
            "provider": "ollama",
            "messages": [{"role": "user", "content": "hello"}],
        },
    )

    assert response.status_code == 502
    assert response.json()["detail"] == "ollama provider request failed: ollama upstream error"
