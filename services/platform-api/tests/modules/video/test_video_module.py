from collections.abc import Generator

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.db import Base
from app.modules.conversation.models import Conversation
from app.modules.customer.models import CustomerProfile
from app.testing.auth_utils import override_authenticated_user, seed_authenticated_user
from app.modules.video.router import router as video_router


def build_test_app(db_session: Session) -> FastAPI:
    application = FastAPI()
    application.include_router(video_router)

    from app.core.db import get_db

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    application.dependency_overrides[get_db] = override_get_db
    user = seed_authenticated_user(
        db_session,
        username="video-admin",
        permissions=["video.read", "video.write"],
    )
    override_authenticated_user(application, user)
    return application


def test_video_session_lifecycle_with_snapshots_and_ticket_transfer() -> None:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    try:
        customer = CustomerProfile(external_id="ext-video-001", name="Video User", email="video@example.com")
        session.add(customer)
        session.commit()
        session.refresh(customer)

        conversation = Conversation(customer_profile_id=customer.id, channel="video", assignee="agent-video", status="open")
        session.add(conversation)
        session.commit()
        session.refresh(conversation)

        client = TestClient(build_test_app(session))

        started = client.post(
            "/video/sessions/start",
            json={
                "customer_profile_id": customer.id,
                "conversation_id": conversation.id,
                "assignee": "agent-video",
            },
        )
        assert started.status_code == 201
        session_id = started.json()["id"]
        assert started.json()["status"] == "active"
        assert started.json()["snapshot_count"] == 0

        current = client.get("/video/sessions/current")
        assert current.status_code == 200
        assert current.json()["id"] == session_id

        snapshot = client.post(
            f"/video/sessions/{session_id}/snapshots",
            json={"label": "抓拍 1", "note": "客户展示订单编号"},
        )
        assert snapshot.status_code == 201
        assert snapshot.json()["label"] == "抓拍 1"

        snapshots = client.get(f"/video/sessions/{session_id}/snapshots")
        assert snapshots.status_code == 200
        assert snapshots.json()["items"][0]["note"] == "客户展示订单编号"

        ticket = client.post(
            f"/video/sessions/{session_id}/transfer-ticket",
            json={
                "title": "视频客服工单",
                "priority": "high",
                "summary": "抓拍后转工单",
                "assignee": "agent-ticket",
                "assignee_group": "售后组",
            },
        )
        assert ticket.status_code == 201
        assert ticket.json()["conversation_id"] == conversation.id
        assert ticket.json()["customer_profile_id"] == customer.id

        listing = client.get("/video/sessions")
        assert listing.status_code == 200
        assert listing.json()["items"][0]["ticket_id"] == ticket.json()["id"]
        assert listing.json()["items"][0]["snapshot_count"] == 1

        ended = client.post(f"/video/sessions/{session_id}/end", json={"reason": "处理完成"})
        assert ended.status_code == 200
        assert ended.json()["status"] == "ended"

        current_after_end = client.get("/video/sessions/current")
        assert current_after_end.status_code == 200
        assert current_after_end.json() is None
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
