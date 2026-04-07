from __future__ import annotations

from dataclasses import dataclass, field

from app.decision.answer_generation import AnswerGenerationService
from app.decision.policy import DecisionPolicyService
from app.decision.query_rewrite import QueryRewriteService
from app.decision.retrieval import RetrievalService
from app.decision.types import DecisionResult


@dataclass(frozen=True, slots=True)
class DecisionPipeline:
    query_rewriter: QueryRewriteService = field(default_factory=QueryRewriteService)
    retriever: RetrievalService = field(default_factory=RetrievalService)
    policy: DecisionPolicyService = field(default_factory=DecisionPolicyService)
    answer_generator: AnswerGenerationService = field(default_factory=AnswerGenerationService)

    def run(self, query: str) -> DecisionResult:
        rewrite = self.query_rewriter.rewrite(query)
        retrieval_summary = self.retriever.retrieve(rewrite)
        decision, clarification, confidence = self.policy.decide(rewrite, retrieval_summary)
        decision_result = DecisionResult(
            query=query,
            rewrite=rewrite,
            retrieval_summary=retrieval_summary,
            decision=decision,
            answer=None,
            clarification=clarification,
            confidence=confidence,
        )
        answer = self.answer_generator.generate(decision_result)
        return DecisionResult(
            query=decision_result.query,
            rewrite=decision_result.rewrite,
            retrieval_summary=decision_result.retrieval_summary,
            decision=decision_result.decision,
            answer=answer,
            clarification=decision_result.clarification,
            confidence=decision_result.confidence,
        )
