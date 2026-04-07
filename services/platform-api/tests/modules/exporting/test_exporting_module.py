from collections.abc import Generator
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import Base
from app.testing.auth_utils import override_authenticated_user, seed_authenticated_user
from app.modules.conversation.models import Conversation
from app.modules.customer.models import CustomerProfile
from app.modules.exporting.router import router as exporting_router
from app.modules.knowledge.models import KnowledgeDocument
from app.modules.service.models import LeaveMessage, Ticket


def _db_path() -> Path:
    return Path("/tmp/platform_api_exporting_test.db")


def _build_app(db_session: Session) -> FastAPI:
    app = FastAPI()
    app.include_router(exporting_router)
    app.dependency_overrides.clear()

    from app.core.db import get_db

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    user = seed_authenticated_user(
        db_session,
        username="export-admin",
        permissions=["export.read", "export.write"],
    )
    override_authenticated_user(app, user)
    return app


def test_export_task_lifecycle_generates_download_url() -> None:
    db_path = _db_path()
    engine = create_engine(f"sqlite:///{db_path}", future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()

    try:
        customer = CustomerProfile(external_id="ext-export-001", name="Export User")
        session.add(customer)
        session.commit()
        session.refresh(customer)

        session.add_all(
            [
                Ticket(title="导出工单 1", status="open", priority="high", source="app", customer_profile_id=customer.id),
                Ticket(title="导出工单 2", status="open", priority="normal", source="web", customer_profile_id=customer.id),
                LeaveMessage(visitor_name="王晨", source="h5", status="pending", subject="留言 1", content="内容 1"),
                Conversation(customer_profile_id=customer.id, channel="web", status="ended"),
                KnowledgeDocument(
                    tenant_id="tenant-export",
                    type="faq",
                    title="退款说明",
                    status="published",
                    category="售后",
                    tags=["退款"],
                    language="zh-CN",
                    channels=["web"],
                    version=2,
                    publish_version=2,
                    source_kind="manual",
                    index_status="completed",
                    indexed_chunk_count=1,
                ),
            ]
        )
        session.commit()

        client = TestClient(_build_app(session))

        created = client.post(
            "/exporting/tasks",
            json={
                "name": "工单导出",
                "source_kind": "tickets",
                "format": "csv",
            },
        )
        assert created.status_code == 201
        assert created.json()["status"] == "pending"
        assert created.json()["download_url"] is None

        listing = client.get("/exporting/tasks")
        assert listing.status_code == 200
        assert listing.json()[0]["name"] == "工单导出"

        task_id = created.json()["id"]
        detail = client.get(f"/exporting/tasks/{task_id}")
        assert detail.status_code == 200
        assert detail.json()["source_kind"] == "tickets"

        executing = client.post(f"/exporting/tasks/{task_id}/execute")
        assert executing.status_code == 200
        assert executing.json()["status"] == "running"
        assert executing.json()["row_count"] == 2

        completed = client.post(f"/exporting/tasks/{task_id}/complete")
        assert completed.status_code == 200
        assert completed.json()["status"] == "completed"
        assert completed.json()["download_url"].startswith("http://testserver/exporting/tasks/")

        download = client.get(f"/exporting/tasks/{task_id}/download")
        assert download.status_code == 200
        assert download.json()["task_id"] == task_id
        assert download.json()["download_url"] == completed.json()["download_url"]
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        if db_path.exists():
            db_path.unlink()
