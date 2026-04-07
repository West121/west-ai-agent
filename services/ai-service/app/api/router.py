from __future__ import annotations

from time import time
from typing import Literal
from functools import lru_cache

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.decision.pipeline import DecisionPipeline
from app.core.config import get_settings
from app.providers.registry import ProviderEntry, build_provider_registry
from app.workflow import SupportWorkflowRequest, SupportWorkflowService

router = APIRouter(tags=["api"])


@lru_cache
def get_decision_pipeline() -> DecisionPipeline:
    return DecisionPipeline()


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool"]
    content: str


class ChatCompletionRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    provider: str | None = None
    temperature: float | None = Field(default=None, ge=0.0)


class DecisionRequest(BaseModel):
    query: str


class WorkflowRequest(BaseModel):
    query: str
    context_slots: dict[str, str] = Field(default_factory=dict)


def select_provider(
    request: ChatCompletionRequest,
    registry: dict[str, ProviderEntry],
) -> ProviderEntry:
    if request.provider:
        provider = registry.get(request.provider)
        if provider is None:
            raise HTTPException(status_code=404, detail=f"Unknown provider: {request.provider}")
        return provider

    model_prefix = request.model.split(":", 1)[0]
    if model_prefix in registry:
        return registry[model_prefix]

    settings = get_settings()
    default_provider = registry.get(settings.default_provider)
    if default_provider is None:
        raise HTTPException(status_code=500, detail=f"Configured default provider not found: {settings.default_provider}")
    return default_provider


@router.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "ai-service"}


@router.get("/providers")
def list_providers() -> dict[str, object]:
    registry = build_provider_registry()
    return {
        "default_provider": get_settings().default_provider,
        "providers": [
            {
                "name": entry.provider.name,
                "models": list(entry.provider.models),
                "is_default": entry.is_default,
                "base_url": entry.base_url,
            }
            for entry in registry.values()
        ]
    }


@router.post("/chat/completions")
def chat_completions(request: ChatCompletionRequest) -> dict[str, object]:
    registry = build_provider_registry()
    entry = select_provider(request, registry)
    try:
        completion = entry.provider.chat_completions(request.model_dump())
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "id": f"chatcmpl-{int(time())}",
        "object": "chat.completion",
        "created": int(time()),
        "model": completion.get("model", request.model),
        "provider": entry.provider.name,
        "choices": completion["choices"],
        "usage": completion.get(
            "usage",
            {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
            },
        ),
    }


def _run_decision(query: str) -> dict[str, object]:
    return get_decision_pipeline().run(query).to_dict()


@router.post("/decision")
def decision(request: DecisionRequest) -> dict[str, object]:
    return _run_decision(request.query)


@router.post("/chat/answer")
def chat_answer(request: DecisionRequest) -> dict[str, object]:
    return _run_decision(request.query)


@router.post("/workflow/triage")
def workflow_triage(request: WorkflowRequest) -> dict[str, object]:
    result = SupportWorkflowService().run(
        SupportWorkflowRequest(
            query=request.query,
            context_slots=request.context_slots,
        )
    )
    return result.to_dict()
