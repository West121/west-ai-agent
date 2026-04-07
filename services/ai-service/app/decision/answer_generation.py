from __future__ import annotations

from app.decision.types import DecisionResult


class AnswerGenerationService:
    def generate(self, decision_result: DecisionResult) -> str | None:
        if decision_result.decision != "answer":
            return None
        if not decision_result.retrieval_summary.matched_documents:
            return None
        top_hit = decision_result.retrieval_summary.matched_documents[0]
        return top_hit.document.answer
