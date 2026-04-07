from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

DecisionName = Literal["answer", "handoff", "clarify", "reject"]

STOPWORDS = frozenset(
    {
        "a",
        "an",
        "and",
        "are",
        "as",
        "be",
        "by",
        "for",
        "from",
        "how",
        "i",
        "in",
        "is",
        "it",
        "of",
        "on",
        "or",
        "the",
        "to",
        "with",
    }
)


@dataclass(frozen=True, slots=True)
class KnowledgeDocument:
    id: str
    title: str
    body: str
    summary: str
    answer: str
    tags: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class RewriteResult:
    original_query: str
    normalized_query: str
    tokens: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "original_query": self.original_query,
            "normalized_query": self.normalized_query,
            "tokens": list(self.tokens),
        }


@dataclass(frozen=True, slots=True)
class RetrievalHit:
    document: KnowledgeDocument
    score: float
    matched_terms: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "document_id": self.document.id,
            "title": self.document.title,
            "score": round(self.score, 3),
            "matched_terms": list(self.matched_terms),
            "summary": self.document.summary,
        }


@dataclass(frozen=True, slots=True)
class RetrievalSummary:
    matched_documents: tuple[RetrievalHit, ...]
    top_score: float
    matched_count: int

    def to_dict(self) -> dict[str, object]:
        return {
            "top_score": round(self.top_score, 3),
            "matched_count": self.matched_count,
            "matched_documents": [hit.to_dict() for hit in self.matched_documents],
        }


@dataclass(frozen=True, slots=True)
class DecisionResult:
    query: str
    rewrite: RewriteResult
    retrieval_summary: RetrievalSummary
    decision: DecisionName
    answer: str | None
    clarification: str | None
    confidence: float

    def to_dict(self) -> dict[str, object]:
        return {
            "query": self.query,
            "rewrite": self.rewrite.to_dict(),
            "retrieval_summary": self.retrieval_summary.to_dict(),
            "decision": self.decision,
            "answer": self.answer,
            "clarification": self.clarification,
            "confidence": round(self.confidence, 3),
        }
