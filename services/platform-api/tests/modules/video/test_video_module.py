from collections.abc import Generator
from io import BytesIO
from pathlib import Path

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
from app.modules.video.storage import get_video_object_storage
from app.core.config import get_settings


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


def test_video_recordings_and_post_call_summary() -> None:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    try:
        customer = CustomerProfile(external_id="ext-video-002", name="Replay User", email="replay@example.com")
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

        recording_1 = client.post(
            f"/video/sessions/{session_id}/recordings",
            json={
                "label": "首段录制",
                "note": "客户展示发票信息",
                "file_key": "video-recordings/session-1/part-1.webm",
                "file_name": "part-1.webm",
                "mime_type": "video/webm",
                "duration_seconds": 98,
            },
        )
        assert recording_1.status_code == 201
        assert recording_1.json()["entry_type"] == "recording"
        assert recording_1.json()["playback_url"].startswith("/video/recordings/")

        recording_2 = client.post(
            f"/video/sessions/{session_id}/recordings",
            json={
                "label": "尾段录制",
                "note": "结束前确认下一步",
                "file_key": "video-recordings/session-1/part-2.webm",
                "file_name": "part-2.webm",
                "mime_type": "video/webm",
                "duration_seconds": 44,
            },
        )
        assert recording_2.status_code == 201
        assert recording_2.json()["duration_seconds"] == 44

        recordings = client.get(f"/video/sessions/{session_id}/recordings")
        assert recordings.status_code == 200
        assert len(recordings.json()["items"]) == 2
        assert recordings.json()["items"][0]["playback_url"].startswith("/video/recordings/")

        summary = client.post(
            f"/video/sessions/{session_id}/summary",
            json={
                "ai_summary": "视频中已确认用户诉求，建议走财务回访。",
                "operator_summary": "客户出示订单和发票截图。",
                "issue_category": "退款",
                "resolution": "已转工单等待回访",
                "next_action": "24 小时内回访并同步处理结果",
                "handoff_reason": "需要财务确认到账状态",
                "follow_up_required": True,
            },
        )
        assert summary.status_code == 200
        assert summary.json()["ai_summary"].startswith("视频中已确认用户诉求")
        assert summary.json()["recording_count"] == 2
        assert summary.json()["latest_recording_at"] is not None
        assert summary.json()["summary_updated_at"] is not None

        summary_detail = client.get(f"/video/sessions/{session_id}/summary")
        assert summary_detail.status_code == 200
        assert summary_detail.json()["issue_category"] == "退款"
        assert summary_detail.json()["next_action"].startswith("24 小时内")
        assert summary_detail.json()["recording_count"] == 2

        listing = client.get("/video/sessions")
        assert listing.status_code == 200
        assert listing.json()["items"][0]["recording_count"] == 2
        assert listing.json()["items"][0]["ai_summary"].startswith("视频中已确认")
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_video_recording_governance_filters_and_retention_state_changes() -> None:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    try:
        customer = CustomerProfile(external_id="ext-video-004", name="Governance User", email="governance@example.com")
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

        retained = client.post(
            f"/video/sessions/{session_id}/recordings",
            json={
                "label": "保留录制",
                "note": "待复核",
                "file_key": "video-recordings/session-4/keep.webm",
                "file_name": "keep.webm",
                "mime_type": "video/webm",
                "duration_seconds": 15,
            },
        )
        assert retained.status_code == 201

        deleted = client.post(
            f"/video/sessions/{session_id}/recordings",
            json={
                "label": "删除录制",
                "note": "待清理",
                "file_key": "video-recordings/session-4/delete.webm",
                "file_name": "delete.webm",
                "mime_type": "video/webm",
                "duration_seconds": 22,
            },
        )
        assert deleted.status_code == 201

        delete_response = client.patch(
            f"/video/recordings/{deleted.json()['id']}/retention",
            json={"retention_state": "deleted", "reason": "合规清理"},
        )
        assert delete_response.status_code == 200
        assert delete_response.json()["retention_state"] == "deleted"
        assert delete_response.json()["retention_reason"] == "合规清理"

        default_listing = client.get(f"/video/sessions/{session_id}/recordings")
        assert default_listing.status_code == 200
        assert default_listing.json()["retention_state"] == "retained"
        assert default_listing.json()["retained_count"] == 1
        assert default_listing.json()["deleted_count"] == 1
        assert len(default_listing.json()["items"]) == 1
        assert default_listing.json()["items"][0]["label"] == "保留录制"

        deleted_listing = client.get(f"/video/sessions/{session_id}/recordings?retention_state=deleted")
        assert deleted_listing.status_code == 200
        assert len(deleted_listing.json()["items"]) == 1
        assert deleted_listing.json()["items"][0]["label"] == "删除录制"
        assert deleted_listing.json()["items"][0]["retention_state"] == "deleted"

        keyword_listing = client.get(f"/video/sessions/{session_id}/recordings?retention_state=all&keyword=清理")
        assert keyword_listing.status_code == 200
        assert len(keyword_listing.json()["items"]) == 1
        assert keyword_listing.json()["items"][0]["label"] == "删除录制"

        detail = client.get(f"/video/recordings/{deleted.json()['id']}")
        assert detail.status_code == 200
        assert detail.json()["retention_state"] == "deleted"
        assert detail.json()["deleted_at"] is not None

        restore_response = client.patch(
            f"/video/recordings/{deleted.json()['id']}/retention",
            json={"retention_state": "retained"},
        )
        assert restore_response.status_code == 200
        assert restore_response.json()["retention_state"] == "retained"
        assert restore_response.json()["deleted_at"] is None

        restored_listing = client.get(f"/video/sessions/{session_id}/recordings")
        assert restored_listing.status_code == 200
        assert restored_listing.json()["retained_count"] == 2
        assert restored_listing.json()["deleted_count"] == 0
        assert restored_listing.json()["total_count"] == 2
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def test_video_recording_upload_and_playback(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("APP_MEDIA_ROOT", str(tmp_path / "media"))
    get_settings.cache_clear()
    get_video_object_storage.cache_clear()

    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    try:
        customer = CustomerProfile(external_id="ext-video-003", name="Uploader", email="upload@example.com")
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

        upload = client.post(
            f"/video/sessions/{session_id}/recordings/upload",
            data={"label": "浏览器录制", "note": "用于回放验证", "duration_seconds": "12"},
            files={"file": ("recording.webm", BytesIO(b"fake-webm-payload"), "video/webm")},
        )
        assert upload.status_code == 201
        recording = upload.json()
        assert recording["file_name"] == "recording.webm"
        assert recording["playback_url"].endswith(f"/video/recordings/{recording['id']}/playback")

        playback = client.get(recording["playback_url"])
        assert playback.status_code == 200
        assert playback.headers["content-type"].startswith("video/webm")
        assert playback.content == b"fake-webm-payload"
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        get_settings.cache_clear()
        get_video_object_storage.cache_clear()
