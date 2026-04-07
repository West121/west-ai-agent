from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_workflow_triage_returns_answer_when_knowledge_matches() -> None:
    client = TestClient(app)

    response = client.post(
        "/workflow/triage",
        json={"query": "How does the default provider get selected?"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["next_action"] == "answer"
    assert body["answer"]
    assert body["handoff_ready"] is False
    assert body["required_slots"] == []
    assert body["missing_slots"] == []


def test_workflow_triage_collects_required_slots_for_refund() -> None:
    client = TestClient(app)

    response = client.post(
        "/workflow/triage",
        json={"query": "我要退款，什么时候到账？"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["next_action"] == "collect_slot"
    assert body["extracted_slots"]["issue_category"] == "refund"
    assert "order_id" in body["required_slots"]
    assert "order_id" in body["missing_slots"]
    assert body["next_prompt"]
    assert body["summary"]


def test_workflow_triage_ready_to_handoff_when_slots_complete() -> None:
    client = TestClient(app)

    response = client.post(
        "/workflow/triage",
        json={
            "query": "我要转人工处理退款，订单号 TK2026040601，手机号 13812345678",
            "context_slots": {"order_id": "TK2026040601"},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["next_action"] == "handoff"
    assert body["handoff_ready"] is True
    assert body["merged_slots"]["order_id"] == "TK2026040601"
    assert body["merged_slots"]["contact_phone"] == "13812345678"
    assert body["next_prompt"]
