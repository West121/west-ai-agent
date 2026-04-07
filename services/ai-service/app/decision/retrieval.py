from __future__ import annotations

from collections.abc import Sequence
from typing import Any

import httpx

from app.core.config import Settings, get_settings
from app.decision.types import KnowledgeDocument, RetrievalHit, RetrievalSummary, RewriteResult, STOPWORDS
from app.providers.registry import build_provider_registry


def _tokenize(text: str) -> tuple[str, ...]:
    tokens = []
    for raw_token in text.lower().replace("/", " ").replace("-", " ").split():
        token = "".join(char for char in raw_token if char.isalnum())
        if token and token not in STOPWORDS:
            tokens.append(token)
    return tuple(tokens)


def build_default_documents() -> tuple[KnowledgeDocument, ...]:
    settings = get_settings()
    registry = build_provider_registry(settings)
    default_provider = next(
        (entry.provider.name for entry in registry.values() if entry.is_default),
        settings.default_provider,
    )
    provider_names = ", ".join(registry.keys())

    return (
        KnowledgeDocument(
            id="provider-selection",
            title="Default provider selection",
            body=(
                "The default provider is selected when no explicit provider is supplied "
                "and no model prefix matches. Available providers are "
                f"{provider_names}. Current default provider: {default_provider}."
            ),
            summary="Select the default provider after explicit provider and model prefix checks.",
            answer=(
                "The service selects the default provider after checking an explicit provider "
                "and a model prefix."
            ),
            tags=("provider", "default", "selection"),
        ),
        KnowledgeDocument(
            id="chat-routing",
            title="Chat completion routing",
            body=(
                "POST /chat/completions routes explicit provider first, then model prefix, "
                "then the configured default provider."
            ),
            summary="Chat completions use explicit provider, model prefix, then the default provider.",
            answer="Routing is explicit provider first, then model prefix, then the configured default provider.",
            tags=("chat", "routing", "completions"),
        ),
        KnowledgeDocument(
            id="handoff-policy",
            title="Human handoff policy",
            body="If a request needs help from a human reviewer, hand off the case.",
            summary="Low confidence requests should be escalated to a human reviewer.",
            answer="This request should be handed off to a human reviewer.",
            tags=("handoff", "support", "review"),
        ),
    )


class RetrievalService:
    def __init__(
        self,
        documents: Sequence[KnowledgeDocument] | None = None,
        settings: Settings | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        self._settings = settings or get_settings()
        self._documents = tuple(documents or build_default_documents())
        self._client = client or httpx.Client(timeout=10.0)

    def retrieve(self, rewrite: RewriteResult, limit: int = 3) -> RetrievalSummary:
        if self._settings.opensearch_url and self._settings.opensearch_index:
            opensearch_summary = self._retrieve_from_opensearch(rewrite, limit)
            if opensearch_summary is not None and opensearch_summary.matched_count > 0:
                return opensearch_summary

        return self._retrieve_from_documents(rewrite, limit)

    def _retrieve_from_documents(self, rewrite: RewriteResult, limit: int) -> RetrievalSummary:
        unique_terms = tuple(dict.fromkeys(rewrite.tokens))
        hits: list[RetrievalHit] = []
        for document in self._documents:
            searchable_terms = set(_tokenize(" ".join((document.title, document.body, document.summary, " ".join(document.tags)))))
            matched_terms = tuple(term for term in unique_terms if term in searchable_terms)
            if not matched_terms:
                continue
            score = len(matched_terms) / len(unique_terms) if unique_terms else 0.0
            hits.append(
                RetrievalHit(
                    document=document,
                    score=score,
                    matched_terms=matched_terms,
                )
            )

        hits.sort(key=lambda hit: (-hit.score, hit.document.title))
        selected_hits = tuple(hits[:limit])
        top_score = selected_hits[0].score if selected_hits else 0.0
        return RetrievalSummary(
            matched_documents=selected_hits,
            top_score=top_score,
            matched_count=len(hits),
        )

    def _retrieve_from_opensearch(self, rewrite: RewriteResult, limit: int) -> RetrievalSummary | None:
        if not rewrite.normalized_query.strip():
            return None

        request_body = {
            "size": limit,
            "query": {
                "bool": {
                    "should": [
                        {"term": {"metadata.question.keyword": rewrite.normalized_query}},
                        {"term": {"keywords.keyword": rewrite.normalized_query}},
                        {"term": {"title_path.keyword": rewrite.normalized_query}},
                        {
                            "multi_match": {
                                "query": rewrite.normalized_query,
                                "fields": [
                                    "title^3",
                                    "content^4",
                                    "title_path^2",
                                    "keywords^2",
                                    "tags",
                                    "metadata.question^4",
                                ],
                                "type": "best_fields",
                            }
                        },
                    ],
                    "minimum_should_match": 1,
                },
            },
        }

        try:
            response = self._client.post(
                f"{self._settings.opensearch_url.rstrip('/')}/{self._settings.opensearch_index}/_search",
                json=request_body,
                auth=self._build_auth(),
            )
            response.raise_for_status()
        except httpx.HTTPError:
            return None

        body = response.json()
        raw_hits = body.get("hits", {}).get("hits", [])
        if not raw_hits:
            return RetrievalSummary(matched_documents=(), top_score=0.0, matched_count=0)

        max_score = max(float(hit.get("_score") or 0.0) for hit in raw_hits) or 1.0
        parsed_hits: list[RetrievalHit] = []
        for raw_hit in raw_hits:
            source = dict(raw_hit.get("_source", {}))
            document = self._map_hit_to_document(source, str(raw_hit.get("_id", "")))
            matched_terms = tuple(term for term in dict.fromkeys(rewrite.tokens) if term in _tokenize(self._searchable_text(source)))
            parsed_hits.append(
                RetrievalHit(
                    document=document,
                    score=min(float(raw_hit.get("_score") or 0.0) / max_score, 1.0),
                    matched_terms=matched_terms,
                )
            )

        top_score = parsed_hits[0].score if parsed_hits else 0.0
        return RetrievalSummary(
            matched_documents=tuple(parsed_hits),
            top_score=top_score,
            matched_count=len(parsed_hits),
        )

    def _searchable_text(self, source: dict[str, Any]) -> str:
        metadata = source.get("metadata", {})
        title_path = source.get("title_path", [])
        keywords = source.get("keywords", [])
        tags = source.get("tags", [])
        values = [
            str(source.get("title", "")),
            str(source.get("content", "")),
            " ".join(str(item) for item in title_path if item),
            " ".join(str(item) for item in keywords if item),
            " ".join(str(item) for item in tags if item),
        ]
        if isinstance(metadata, dict):
            values.append(str(metadata.get("question", "")))
        return " ".join(part for part in values if part)

    def _map_hit_to_document(self, source: dict[str, Any], default_id: str) -> KnowledgeDocument:
        metadata = source.get("metadata", {})
        question = str(metadata.get("question", "")) if isinstance(metadata, dict) else ""
        title = str(source.get("title", "")) or question or "Knowledge hit"
        content = str(source.get("content", ""))
        summary = question or content[:120]
        return KnowledgeDocument(
            id=str(source.get("chunk_id") or default_id),
            title=title,
            body=content,
            summary=summary,
            answer=content,
            tags=tuple(str(item) for item in source.get("tags", []) if item),
        )

    def _build_auth(self) -> httpx.BasicAuth | None:
        if self._settings.opensearch_username and self._settings.opensearch_password:
            return httpx.BasicAuth(self._settings.opensearch_username, self._settings.opensearch_password)
        return None
