from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

WorkflowAction = Literal["answer", "collect_slot", "handoff", "reject"]
WorkflowMode = Literal["decision_pipeline", "langgraph"]


@dataclass(frozen=True, slots=True)
class SupportWorkflowRequest:
    query: str
    context_slots: dict[str, str]


@dataclass(frozen=True, slots=True)
class SupportWorkflowResult:
    query: str
    normalized_query: str
    workflow_mode: WorkflowMode
    flow_category: str | None
    decision: str
    confidence: float
    extracted_slots: dict[str, str]
    merged_slots: dict[str, str]
    required_slots: list[str]
    missing_slots: list[str]
    handoff_ready: bool
    next_action: WorkflowAction
    next_prompt: str | None
    answer: str | None
    clarification: str | None
    summary: str
    graph_trace: list[str]

    def to_dict(self) -> dict[str, object]:
        return {
            "query": self.query,
            "normalized_query": self.normalized_query,
            "workflow_mode": self.workflow_mode,
            "flow_category": self.flow_category,
            "decision": self.decision,
            "confidence": round(self.confidence, 3),
            "extracted_slots": self.extracted_slots,
            "merged_slots": self.merged_slots,
            "required_slots": self.required_slots,
            "missing_slots": self.missing_slots,
            "handoff_ready": self.handoff_ready,
            "next_action": self.next_action,
            "next_prompt": self.next_prompt,
            "answer": self.answer,
            "clarification": self.clarification,
            "summary": self.summary,
            "graph_trace": self.graph_trace,
        }
