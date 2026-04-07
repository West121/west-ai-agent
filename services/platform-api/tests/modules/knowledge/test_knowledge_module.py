from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import Base
from app.modules.knowledge.models import KnowledgeDocument


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    db_path = Path("/tmp/platform_api_knowledge_test.db")
    engine = create_engine(f"sqlite:///{db_path}", future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        if db_path.exists():
            db_path.unlink()


@pytest.fixture()
def client(db_session: Session) -> TestClient:
    from app.core.db import get_db
    from app.modules.knowledge.router import router as knowledge_router

    app = FastAPI()
    app.include_router(knowledge_router)

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def test_knowledge_document_draft_review_and_publish_flow(client: TestClient) -> None:
    created = client.post(
        "/knowledge/documents",
        json={
            "tenant_id": "tenant-1",
            "type": "faq",
            "title": "Refund policy",
            "category": "support",
            "tags": ["billing", "refund"],
            "language": "zh-CN",
            "channels": ["web", "wechat"],
        },
    )

    assert created.status_code == 201
    document_id = created.json()["id"]
    assert created.json()["status"] == "draft"
    assert created.json()["version"] == 1

    submitted = client.post(f"/knowledge/documents/{document_id}/submit-review")
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "in_review"

    published = client.post(
        f"/knowledge/documents/{document_id}/publish-version",
        json={"publish_version": 1},
    )
    assert published.status_code == 200
    assert published.json()["status"] == "published"
    assert published.json()["publish_version"] == 1


def test_knowledge_document_invalid_transition_returns_conflict(client: TestClient) -> None:
    created = client.post(
        "/knowledge/documents",
        json={
            "tenant_id": "tenant-2",
            "type": "article",
            "title": "Escalation guide",
            "category": "ops",
            "tags": [],
            "language": "en-US",
            "channels": ["web"],
        },
    )
    document_id = created.json()["id"]

    published = client.post(
        f"/knowledge/documents/{document_id}/publish-version",
        json={"publish_version": 1},
    )
    assert published.status_code == 409


def test_knowledge_document_import_rebuild_and_publish_flow(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.modules.knowledge import crud

    def fake_runner(payload: dict[str, object]) -> dict[str, object]:
        assert payload["title"] == "退款新规"
        assert payload["content"] == "# 退款说明\n支持七天无理由退款。\n## 到账时效\n原路退款一般 1 到 3 个工作日到账。"
        return {
            "payload": {
                "document_id": "1",
                "documents": [
                    {"chunk_id": "1-slice-1"},
                    {"chunk_id": "1-slice-2"},
                ],
            },
            "search_index": {
                "provider": "in_memory",
                "indexed_count": 2,
            },
        }

    monkeypatch.setattr(crud, "run_worker_knowledge_index_job", fake_runner)

    imported = client.post(
        "/knowledge/documents/import",
        json={
            "tenant_id": "tenant-import",
            "type": "article",
            "title": "退款新规",
            "category": "support",
            "tags": ["refund", "policy"],
            "language": "zh-CN",
            "channels": ["web", "h5"],
            "content": "# 退款说明\n支持七天无理由退款。\n## 到账时效\n原路退款一般 1 到 3 个工作日到账。",
        },
    )

    assert imported.status_code == 201
    document_id = imported.json()["id"]
    assert imported.json()["source_kind"] == "imported"
    assert imported.json()["index_status"] == "idle"
    assert imported.json()["indexed_chunk_count"] == 0

    rebuilt = client.post(f"/knowledge/documents/{document_id}/rebuild-index")
    assert rebuilt.status_code == 200
    assert rebuilt.json()["status"] == "completed"
    assert rebuilt.json()["indexed_chunk_count"] == 2
    assert rebuilt.json()["document_id"] == document_id
    assert rebuilt.json()["result"]["search_index"]["indexed_count"] == 2

    detail = client.get(f"/knowledge/documents/{document_id}")
    assert detail.status_code == 200
    assert detail.json()["index_status"] == "completed"
    assert detail.json()["indexed_chunk_count"] == 2
    assert detail.json()["last_indexed_at"] is not None

    submitted = client.post(f"/knowledge/documents/{document_id}/submit-review")
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "in_review"

    published = client.post(
        f"/knowledge/documents/{document_id}/publish-version",
        json={"publish_version": 3},
    )
    assert published.status_code == 200
    assert published.json()["status"] == "published"
    assert published.json()["publish_version"] == 3
    assert published.json()["published_at"] is not None


def test_knowledge_document_rebuild_index_updates_indexing_state(client: TestClient) -> None:
    created = client.post(
        "/knowledge/documents",
        json={
            "tenant_id": "tenant-3",
            "type": "article",
            "title": "退款规则说明",
            "category": "售后",
            "tags": ["退款"],
            "language": "zh-CN",
            "channels": ["web"],
            "content": "一般情况下 1 到 3 个工作日到账。\n若银行处理较慢，可延长到 5 个工作日。",
        },
    )

    document_id = created.json()["id"]
    rebuilt = client.post(f"/knowledge/documents/{document_id}/rebuild-index")

    assert rebuilt.status_code == 200
    body = rebuilt.json()
    assert body["status"] == "completed"
    assert body["task_id"] == f"knowledge-{document_id}-v1"
    assert body["indexed_chunk_count"] == 1
    assert body["indexed_at"] is not None
    assert body["result"]["search_index"]["indexed_count"] == 1

    detail = client.get(f"/knowledge/documents/{document_id}")
    assert detail.status_code == 200
    assert detail.json()["index_status"] == "completed"
    assert detail.json()["last_index_task_id"] == f"knowledge-{document_id}-v1"
    assert detail.json()["indexed_chunk_count"] == 1
    assert detail.json()["last_indexed_at"] is not None
