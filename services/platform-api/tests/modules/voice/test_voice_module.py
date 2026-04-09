from collections.abc import Generator

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.db import Base
from app.modules.conversation.models import Conversation
from app.modules.customer.models import CustomerProfile
from app.modules.voice.router import router as voice_router
from app.testing.auth_utils import override_authenticated_user, seed_authenticated_user


def build_test_app(db_session: Session) -> FastAPI:
    application = FastAPI()
    application.include_router(voice_router)

    from app.core.db import get_db

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    application.dependency_overrides[get_db] = override_get_db
    user = seed_authenticated_user(
        db_session,
        username="voice-admin",
        permissions=["voice.read", "voice.write"],
    )
    override_authenticated_user(application, user)
    return application


def test_voice_session_transcripts_assets_and_handoff() -> None:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()

    try:
        customer = CustomerProfile(external_id="voice-ext-001", name="Voice User", email="voice@example.com")
        session.add(customer)
        session.commit()
        session.refresh(customer)

        conversation = Conversation(customer_profile_id=customer.id, channel="voice", assignee="agent-voice", status="open")
        session.add(conversation)
        session.commit()
        session.refresh(conversation)

        client = TestClient(build_test_app(session))

        created = client.post(
            "/voice/sessions",
            json={
                "conversation_id": conversation.id,
                "customer_profile_id": customer.id,
                "channel": "voice",
                "status": "listening",
                "livekit_room": "voice-room-001",
                "stt_provider": "sherpa-onnx",
                "finalizer_provider": "funasr",
                "tts_provider": "sherpa-onnx",
            },
        )
        assert created.status_code == 201
        voice_session_id = created.json()["id"]
        assert created.json()["transcript_count"] == 0

        partial = client.post(
            f"/voice/sessions/{voice_session_id}/transcripts",
            json={
                "speaker": "customer",
                "text": "我想咨询退货",
                "normalized_text": "我想咨询退货",
                "is_final": False,
                "start_ms": 0,
                "end_ms": 800,
            },
        )
        assert partial.status_code == 201
        assert partial.json()["is_final"] is False

        final = client.post(
            f"/voice/sessions/{voice_session_id}/transcripts",
            json={
                "speaker": "assistant",
                "text": "您好，请提供订单号。",
                "normalized_text": "您好，请提供订单号。",
                "is_final": True,
                "start_ms": 801,
                "end_ms": 1800,
            },
        )
        assert final.status_code == 201
        assert final.json()["speaker"] == "assistant"

        transcripts = client.get(f"/voice/sessions/{voice_session_id}/transcripts")
        assert transcripts.status_code == 200
        assert len(transcripts.json()["items"]) == 2

        asset = client.post(
            f"/voice/sessions/{voice_session_id}/assets",
            json={
                "asset_type": "tts_output",
                "file_key": "voice/session-1/reply.wav",
                "mime_type": "audio/wav",
                "duration_ms": 1250,
            },
        )
        assert asset.status_code == 201
        assert asset.json()["asset_type"] == "tts_output"

        handoff = client.post(
            f"/voice/sessions/{voice_session_id}/handoff",
            json={
                "reason": "用户要求转人工",
                "summary": "用户咨询退货流程，已提示提供订单号。",
                "handed_off_to": "agent-human-01",
            },
        )
        assert handoff.status_code == 201
        assert handoff.json()["handed_off_to"] == "agent-human-01"

        detail = client.get(f"/voice/sessions/{voice_session_id}")
        assert detail.status_code == 200
        assert detail.json()["transcript_count"] == 2
        assert detail.json()["audio_asset_count"] == 1
        assert detail.json()["handoff_count"] == 1
        assert detail.json()["handoff_pending"] is True

        sessions = client.get(f"/voice/sessions?conversation_id={conversation.id}")
        assert sessions.status_code == 200
        assert len(sessions.json()["items"]) == 1
        assert sessions.json()["items"][0]["id"] == voice_session_id

        assets = client.get(f"/voice/sessions/{voice_session_id}/assets")
        assert assets.status_code == 200
        assert len(assets.json()["items"]) == 1
        assert assets.json()["items"][0]["file_key"] == "voice/session-1/reply.wav"

        handoffs = client.get(f"/voice/sessions/{voice_session_id}/handoff")
        assert handoffs.status_code == 200
        assert len(handoffs.json()["items"]) == 1
        assert handoffs.json()["items"][0]["reason"] == "用户要求转人工"
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
