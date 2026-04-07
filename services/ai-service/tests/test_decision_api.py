from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_decision_returns_answer_for_knowledge_hit() -> None:
    client = TestClient(app)

    response = client.post(
        "/decision",
        json={"query": "How does the default provider get selected?"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["decision"] == "answer"
    assert body["answer"]
    assert body["retrieval_summary"]["matched_documents"]
    assert body["retrieval_summary"]["top_score"] > 0.5


def test_decision_returns_handoff_for_low_confidence_query() -> None:
    client = TestClient(app)

    response = client.post(
        "/decision",
        json={"query": "I need help with a complicated service issue"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["decision"] == "handoff"
    assert body["answer"] is None
    assert body["retrieval_summary"]["matched_documents"]
    assert body["retrieval_summary"]["top_score"] < 0.5


def test_decision_returns_reject_when_no_knowledge_matches() -> None:
    client = TestClient(app)

    response = client.post(
        "/decision",
        json={"query": "Explain black holes and quantum foam"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["decision"] == "reject"
    assert body["answer"] is None
    assert body["retrieval_summary"]["matched_documents"] == []
