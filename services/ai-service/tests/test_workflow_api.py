from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.workflow import SupportWorkflowRequest, SupportWorkflowService


def test_workflow_triage_keeps_faq_queries_on_decision_pipeline() -> None:
    client = TestClient(app)

    response = client.post(
        "/workflow/triage",
        json={"query": "How does the default provider get selected?"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["workflow_mode"] == "decision_pipeline"
    assert body["flow_category"] is None
    assert body["next_action"] == "answer"
    assert body["answer"]
    assert body["handoff_ready"] is False
    assert body["required_slots"] == []
    assert body["missing_slots"] == []


def test_workflow_triage_routes_refund_to_langgraph() -> None:
    client = TestClient(app)

    response = client.post(
        "/workflow/triage",
        json={"query": "我要退款，订单号 TK2026040601，什么时候到账？"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["workflow_mode"] == "langgraph"
    assert body["flow_category"] == "refund"
    assert body["graph_trace"][0] == "langgraph:classify:refund"
    assert body["next_action"] == "collect_slot"
    assert body["extracted_slots"]["issue_category"] == "refund"
    assert "order_id" in body["required_slots"]
    assert "contact_phone" in body["missing_slots"]
    assert body["next_prompt"]
    assert body["summary"]


def test_workflow_triage_routes_after_sale_to_langgraph() -> None:
    client = TestClient(app)

    response = client.post(
        "/workflow/triage",
        json={
            "query": "售后问题：订单号 TK2026040602，手机号 13812345678，麻烦处理一下",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["workflow_mode"] == "langgraph"
    assert body["flow_category"] == "after_sale"
    assert body["graph_trace"][0] == "langgraph:classify:after_sale"
    assert body["next_action"] == "handoff"
    assert body["handoff_ready"] is True
    assert body["merged_slots"]["issue_summary"] == "处理一下"
    assert body["missing_slots"] == []
    assert body["next_prompt"]


def test_workflow_triage_routes_account_freeze_to_langgraph() -> None:
    client = TestClient(app)

    response = client.post(
        "/workflow/triage",
        json={
            "query": "账号冻结了，我是张三，手机号 13812345678，请尽快处理",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["workflow_mode"] == "langgraph"
    assert body["flow_category"] == "account_freeze"
    assert body["graph_trace"][0] == "langgraph:classify:account_freeze"
    assert body["next_action"] == "handoff"
    assert body["handoff_ready"] is True
    assert body["merged_slots"]["customer_name"] == "张三"
    assert body["merged_slots"]["contact_phone"] == "13812345678"
    assert body["next_prompt"]


def test_workflow_triage_routes_invoice_to_langgraph() -> None:
    client = TestClient(app)

    response = client.post(
        "/workflow/triage",
        json={
            "query": "我要开票，订单号 TK2026040603，邮箱 test@example.com",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["workflow_mode"] == "langgraph"
    assert body["flow_category"] == "invoice"
    assert body["graph_trace"][0] == "langgraph:classify:invoice"
    assert body["next_action"] == "handoff"
    assert body["handoff_ready"] is True
    assert body["merged_slots"]["order_id"] == "TK2026040603"
    assert body["merged_slots"]["contact_email"] == "test@example.com"


def test_workflow_service_reuses_context_slots_for_multi_turn_flow() -> None:
    service = SupportWorkflowService()

    first = service.run(
        SupportWorkflowRequest(
            query="售后问题，订单号 TK2026040604，手机号 13812345678",
            context_slots={},
        )
    )

    assert first.workflow_mode == "langgraph"
    assert first.flow_category == "after_sale"
    assert first.next_action == "collect_slot"
    assert first.missing_slots == ["issue_summary"]
    assert first.graph_trace[0] == "langgraph:classify:after_sale"

    second = service.run(
        SupportWorkflowRequest(
            query="补充一下，问题是商品破损",
            context_slots={
                "issue_category": "after_sale",
                "order_id": "TK2026040604",
                "contact_phone": "13812345678",
                "issue_summary": "商品破损",
            },
        )
    )

    assert second.workflow_mode == "langgraph"
    assert second.flow_category == "after_sale"
    assert second.next_action == "handoff"
    assert second.handoff_ready is True
    assert second.missing_slots == []
    assert second.merged_slots["issue_summary"] == "商品破损"
