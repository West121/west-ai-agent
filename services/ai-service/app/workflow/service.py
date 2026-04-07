from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Final

from app.decision.pipeline import DecisionPipeline
from app.workflow.graph import ComplexWorkflowGraph, classify_flow_category, normalize_query
from app.workflow.types import SupportWorkflowRequest, SupportWorkflowResult, WorkflowAction

PHONE_PATTERN: Final = re.compile(r"(?<!\d)(1[3-9]\d{9})(?!\d)")
ORDER_PATTERN: Final = re.compile(r"(?:订单号|订单|工单号|ticket(?:\s*id)?)\s*[:：# ]*\s*([A-Za-z0-9_-]{4,})", re.IGNORECASE)
EMAIL_PATTERN: Final = re.compile(r"([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})")
NAME_PATTERN: Final = re.compile(r"(?:我是|叫|姓名是)\s*([\u4e00-\u9fffA-Za-z]{2,10})")


def _normalize_query(query: str) -> str:
    return " ".join(query.strip().lower().split())


def _first_match(pattern: re.Pattern[str], query: str) -> str | None:
    match = pattern.search(query)
    if not match:
        return None
    return match.group(1).strip()


def _extract_issue_category(query: str) -> str:
    normalized = query.lower()
    category_rules = (
        ("refund", ("退款", "退钱", "退款到账", "原路退回")),
        ("invoice", ("发票", "开票", "补票")),
        ("logistics", ("物流", "快递", "配送", "发货")),
        ("payment", ("支付", "付款", "扣款", "到账", "支付失败")),
        ("login", ("登录", "登陆", "验证码", "密码")),
        ("ticket", ("工单", "售后", "报修", "维修")),
        ("complaint", ("投诉", "差评", "举报")),
    )
    for category, keywords in category_rules:
        if any(keyword in normalized for keyword in keywords):
            return category
    return "general"


def _extract_urgency(query: str) -> str:
    normalized = query.lower()
    if any(keyword in normalized for keyword in ("urgent", "尽快", "马上", "立刻", "加急", "急")):
        return "high"
    if any(keyword in normalized for keyword in ("投诉", "催", "一直", "太慢", "迟迟", "超时")):
        return "medium"
    return "normal"


def _extract_slots(query: str) -> dict[str, str]:
    slots: dict[str, str] = {}
    if order_id := _first_match(ORDER_PATTERN, query):
        slots["order_id"] = order_id
    if phone := _first_match(PHONE_PATTERN, query):
        slots["contact_phone"] = phone
    if email := _first_match(EMAIL_PATTERN, query):
        slots["contact_email"] = email
    if name := _first_match(NAME_PATTERN, query):
        slots["customer_name"] = name

    slots["issue_category"] = _extract_issue_category(query)
    slots["urgency"] = _extract_urgency(query)

    if any(keyword in query.lower() for keyword in ("转人工", "人工", "客服", "真人")):
        slots["handoff_requested"] = "true"

    return slots


def _required_slots(issue_category: str) -> list[str]:
    mapping = {
        "refund": ["order_id", "contact_phone"],
        "invoice": ["order_id", "contact_email"],
        "logistics": ["order_id", "contact_phone"],
        "payment": ["order_id"],
        "login": ["customer_name", "contact_phone"],
        "ticket": ["order_id", "contact_phone"],
        "complaint": ["contact_phone"],
        "general": [],
    }
    return mapping.get(issue_category, [])


def _merge_slots(context_slots: dict[str, str], extracted_slots: dict[str, str]) -> dict[str, str]:
    merged = dict(context_slots)
    for key, value in extracted_slots.items():
        if value:
            merged[key] = value
    return merged


@dataclass(frozen=True, slots=True)
class SupportWorkflowService:
    pipeline: DecisionPipeline = field(default_factory=DecisionPipeline)
    graph: ComplexWorkflowGraph = field(default_factory=ComplexWorkflowGraph)

    def run(self, request: SupportWorkflowRequest) -> SupportWorkflowResult:
        normalized_query = normalize_query(request.query)
        flow_category = classify_flow_category(request.query)
        if flow_category is not None:
            graph_result = self.graph.run(request)
            return SupportWorkflowResult(
                query=graph_result.query,
                normalized_query=graph_result.normalized_query,
                workflow_mode=graph_result.workflow_mode,
                flow_category=graph_result.flow_category,
                decision=graph_result.decision,
                confidence=graph_result.confidence,
                extracted_slots=graph_result.extracted_slots,
                merged_slots=graph_result.merged_slots,
                required_slots=graph_result.required_slots,
                missing_slots=graph_result.missing_slots,
                handoff_ready=graph_result.handoff_ready,
                next_action=graph_result.next_action,
                next_prompt=graph_result.next_prompt,
                answer=graph_result.answer,
                clarification=graph_result.clarification,
                summary=graph_result.summary,
                graph_trace=graph_result.graph_trace,
            )

        extracted_slots = _extract_slots(request.query)
        merged_slots = _merge_slots(request.context_slots, extracted_slots)

        decision_result = self.pipeline.run(request.query)
        required_slots = _required_slots(extracted_slots["issue_category"])
        missing_slots = [slot for slot in required_slots if not merged_slots.get(slot)]
        explicit_handoff = merged_slots.get("handoff_requested") == "true"
        handoff_ready = explicit_handoff or (not missing_slots and decision_result.decision in {"handoff", "reject"})

        if decision_result.decision == "answer":
            next_action: WorkflowAction = "answer"
            next_prompt = decision_result.answer
        elif missing_slots:
            next_action = "collect_slot"
            next_prompt = self._build_slot_prompt(extracted_slots["issue_category"], missing_slots)
        elif handoff_ready:
            next_action = "handoff"
            next_prompt = "已准备好转人工，可附带当前槽位和摘要直接派单。"
        elif decision_result.decision == "clarify":
            next_action = "collect_slot"
            next_prompt = decision_result.clarification
        else:
            next_action = "reject"
            next_prompt = "当前信息不足，建议继续补充问题背景或直接转人工。"

        summary = self._build_summary(decision_result.decision, required_slots, missing_slots, next_action)
        return SupportWorkflowResult(
            query=request.query,
            normalized_query=normalized_query,
            workflow_mode="decision_pipeline",
            flow_category=None,
            decision=decision_result.decision,
            confidence=decision_result.confidence,
            extracted_slots=extracted_slots,
            merged_slots=merged_slots,
            required_slots=required_slots,
            missing_slots=missing_slots,
            handoff_ready=handoff_ready,
            next_action=next_action,
            next_prompt=next_prompt,
            answer=decision_result.answer,
            clarification=decision_result.clarification,
            summary=summary,
            graph_trace=["decision_pipeline"],
        )

    def _build_slot_prompt(self, issue_category: str, missing_slots: list[str]) -> str:
        labels = {
            "order_id": "订单号",
            "contact_phone": "手机号",
            "contact_email": "邮箱",
            "customer_name": "姓名",
        }
        readable_missing = "、".join(labels.get(slot, slot) for slot in missing_slots)
        if issue_category == "refund":
            return f"退款流程还差 {readable_missing}，补齐后可直接转人工或继续处理。"
        if issue_category == "invoice":
            return f"开票流程还差 {readable_missing}，补齐后可直接转人工或继续处理。"
        return f"当前还差 {readable_missing}，补齐后可继续流转。"

    def _build_summary(
        self,
        decision: str,
        required_slots: list[str],
        missing_slots: list[str],
        next_action: str,
    ) -> str:
        if next_action == "answer":
            return "命中知识库，直接回答用户。"
        if next_action == "handoff":
            return "槽位齐全，可直接转人工处理。"
        if next_action == "collect_slot":
            return f"当前决策为 {decision}，需要先补齐 {len(missing_slots)} 个槽位。"
        return f"当前决策为 {decision}，建议继续补充信息。"
