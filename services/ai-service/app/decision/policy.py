from __future__ import annotations

from app.decision.types import DecisionName, RetrievalSummary, RewriteResult


class DecisionPolicyService:
    answer_threshold = 0.6
    handoff_threshold = 0.2

    def decide(
        self,
        rewrite: RewriteResult,
        retrieval_summary: RetrievalSummary,
    ) -> tuple[DecisionName, str | None, float]:
        if retrieval_summary.matched_count == 0:
            return "reject", None, 0.0

        top_score = retrieval_summary.top_score
        if top_score >= self.answer_threshold:
            return "answer", None, top_score
        if top_score >= self.handoff_threshold:
            return "handoff", None, top_score
        if len(rewrite.tokens) <= 2:
            return "clarify", "Please add a bit more detail so I can route this correctly.", top_score
        return "reject", None, top_score
