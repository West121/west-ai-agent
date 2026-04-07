from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Final, Literal

from app.workflow.types import SupportWorkflowRequest, WorkflowAction

ComplexFlowCategory = Literal[
    "refund",
    "after_sale",
    "account_freeze",
    "invoice",
    "logistics",
    "payment_issue",
    "complaint",
]

COMPLEX_FLOW_CATEGORIES: tuple[ComplexFlowCategory, ...] = (
    "refund",
    "after_sale",
    "account_freeze",
    "invoice",
    "logistics",
    "payment_issue",
    "complaint",
)

PHONE_PATTERN: Final = re.compile(r"(?<!\d)(1[3-9]\d{9})(?!\d)")
ORDER_PATTERN: Final = re.compile(r"(?:订单号|订单|工单号|ticket(?:\s*id)?)\s*[:：# ]*\s*([A-Za-z0-9_-]{4,})", re.IGNORECASE)
EMAIL_PATTERN: Final = re.compile(r"([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})")
NAME_PATTERN: Final = re.compile(r"(?:我是|叫|姓名是)\s*([\u4e00-\u9fffA-Za-z]{2,10})")


def normalize_query(query: str) -> str:
    return " ".join(query.strip().lower().split())


def _first_match(pattern: re.Pattern[str], query: str) -> str | None:
    match = pattern.search(query)
    if not match:
        return None
    return match.group(1).strip()


def classify_flow_category(query: str) -> ComplexFlowCategory | None:
    normalized = normalize_query(query)
    category_rules: tuple[tuple[ComplexFlowCategory, tuple[str, ...]], ...] = (
        ("refund", ("退款", "退钱", "退款到账", "原路退回")),
        ("after_sale", ("售后", "退换", "换货", "维修", "保修", "返修", "退货")),
        ("account_freeze", ("账号冻结", "冻结", "封号", "锁定", "停用", "账号被封", "账号异常")),
        ("invoice", ("发票", "开票", "补票", "电子票")),
        ("logistics", ("物流", "快递", "配送", "发货", "包裹", "签收")),
        ("payment_issue", ("支付失败", "付款失败", "扣款", "不到账", "到账", "支付异常", "交易失败")),
        ("complaint", ("投诉", "差评", "举报", "不满", "申诉")),
    )
    for category, keywords in category_rules:
        if any(keyword in normalized for keyword in keywords):
            return category
    return None


def extract_issue_summary(query: str) -> str | None:
    normalized = query.strip()
    summary_patterns = (
        r"(?:问题是|情况是|诉求是|描述是|原因是|现象是)\s*([^。！？;\n]{2,80})",
        r"(?:麻烦|请帮我|帮我)\s*([^。！？;\n]{2,80})",
    )
    for pattern in summary_patterns:
        match = re.search(pattern, normalized)
        if match:
            candidate = match.group(1).strip()
            if len(candidate) >= 4 and not re.search(r"(订单|手机号|电话|邮箱|ticket|invoice|发票)", candidate):
                return candidate
    return None


def extract_slots(query: str, category: ComplexFlowCategory) -> dict[str, str]:
    slots: dict[str, str] = {}
    if order_id := _first_match(ORDER_PATTERN, query):
        slots["order_id"] = order_id
    if phone := _first_match(PHONE_PATTERN, query):
        slots["contact_phone"] = phone
    if email := _first_match(EMAIL_PATTERN, query):
        slots["contact_email"] = email
    if name := _first_match(NAME_PATTERN, query):
        slots["customer_name"] = name

    slots["issue_category"] = category
    if issue_summary := extract_issue_summary(query):
        slots["issue_summary"] = issue_summary

    normalized = normalize_query(query)
    if any(keyword in normalized for keyword in ("转人工", "人工", "客服", "真人")):
        slots["handoff_requested"] = "true"

    return slots


def required_slots(category: ComplexFlowCategory) -> list[str]:
    mapping: dict[ComplexFlowCategory, list[str]] = {
        "refund": ["order_id", "contact_phone"],
        "after_sale": ["order_id", "contact_phone", "issue_summary"],
        "account_freeze": ["customer_name", "contact_phone"],
        "invoice": ["order_id", "contact_email"],
        "logistics": ["order_id", "contact_phone", "issue_summary"],
        "payment_issue": ["order_id", "issue_summary"],
        "complaint": ["contact_phone", "issue_summary"],
    }
    return mapping[category]


def build_slot_prompt(category: ComplexFlowCategory, missing_slots: list[str]) -> str:
    labels = {
        "order_id": "订单号",
        "contact_phone": "手机号",
        "contact_email": "邮箱",
        "customer_name": "姓名",
        "issue_summary": "问题描述",
    }
    readable_missing = "、".join(labels.get(slot, slot) for slot in missing_slots)
    if category == "refund":
        return f"退款流程还差 {readable_missing}，补齐后即可转人工或继续处理。"
    if category == "after_sale":
        return f"售后流程还差 {readable_missing}，补齐后即可转人工或继续处理。"
    if category == "account_freeze":
        return f"账号冻结流程还差 {readable_missing}，补齐后即可转人工或继续处理。"
    if category == "invoice":
        return f"开票流程还差 {readable_missing}，补齐后即可转人工或继续处理。"
    if category == "logistics":
        return f"物流流程还差 {readable_missing}，补齐后即可转人工或继续处理。"
    if category == "payment_issue":
        return f"支付问题还差 {readable_missing}，补齐后即可转人工或继续处理。"
    return f"投诉/申诉流程还差 {readable_missing}，补齐后即可转人工或继续处理。"


def build_summary(category: ComplexFlowCategory, next_action: WorkflowAction, missing_slots: list[str]) -> str:
    if next_action == "handoff":
        return f"LangGraph 已接管 {category} 流程，槽位齐全，可直接转人工。"
    if next_action == "collect_slot":
        return f"LangGraph 已接管 {category} 流程，还需补齐 {len(missing_slots)} 个槽位。"
    if next_action == "reject":
        return f"LangGraph 已接管 {category} 流程，但当前信息仍不足。"
    return f"LangGraph 已接管 {category} 流程，已可直接回答。"


@dataclass(frozen=True, slots=True)
class ComplexWorkflowOutcome:
    query: str
    normalized_query: str
    workflow_mode: Literal["langgraph"]
    flow_category: ComplexFlowCategory
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


class ComplexWorkflowGraph:
    def run(
        self,
        request: SupportWorkflowRequest,
        flow_category: ComplexFlowCategory | None = None,
    ) -> ComplexWorkflowOutcome:
        flow_category = flow_category or classify_flow_category(request.query)
        if flow_category is None:
            raise ValueError("complex workflow graph requires a refund, after-sale, or account-freeze query")

        normalized_query = normalize_query(request.query)
        trace: list[str] = [f"langgraph:classify:{flow_category}"]

        extracted_slots = extract_slots(request.query, flow_category)
        trace.append("langgraph:extract_slots")

        merged_slots = dict(request.context_slots)
        merged_slots.update({key: value for key, value in extracted_slots.items() if value})
        trace.append("langgraph:merge_context")

        required = required_slots(flow_category)
        missing_slots = [slot for slot in required if not merged_slots.get(slot)]
        trace.append("langgraph:collect_requirements")

        explicit_handoff = merged_slots.get("handoff_requested") == "true"
        handoff_ready = explicit_handoff or not missing_slots
        if missing_slots:
            next_action: WorkflowAction = "collect_slot"
            next_prompt = build_slot_prompt(flow_category, missing_slots)
            decision = "clarify"
            confidence = 0.78
            clarification = next_prompt
            answer = None
        elif handoff_ready:
            next_action = "handoff"
            next_prompt = "已准备好转人工，可附带当前槽位和摘要直接派单。"
            decision = "handoff"
            confidence = 0.91
            clarification = None
            answer = None
        else:
            next_action = "reject"
            next_prompt = "当前信息不足，建议继续补充问题背景或直接转人工。"
            decision = "reject"
            confidence = 0.55
            clarification = next_prompt
            answer = None

        trace.append(f"langgraph:decide:{next_action}")
        summary = build_summary(flow_category, next_action, missing_slots)
        trace.append("langgraph:finalize")

        return ComplexWorkflowOutcome(
            query=request.query,
            normalized_query=normalized_query,
            workflow_mode="langgraph",
            flow_category=flow_category,
            decision=decision,
            confidence=confidence,
            extracted_slots=extracted_slots,
            merged_slots=merged_slots,
            required_slots=required,
            missing_slots=missing_slots,
            handoff_ready=handoff_ready,
            next_action=next_action,
            next_prompt=next_prompt,
            answer=answer,
            clarification=clarification,
            summary=summary,
            graph_trace=trace,
        )
