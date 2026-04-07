from collections.abc import Generator
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import Base, get_db
from app.modules.channel.router import router as channel_router
from app.modules.conversation.router import router as conversation_router
from app.modules.customer.models import CustomerProfile
from app.modules.exporting.router import router as exporting_router
from app.modules.public.router import router as public_router
from app.modules.service.router import router as service_router
from app.modules.video.router import router as video_router


def _db_path() -> Path:
    return Path("/tmp/platform_api_access_control_test.db")


def _build_app(db_session: Session) -> FastAPI:
    app = FastAPI()
    app.include_router(channel_router)
    app.include_router(conversation_router)
    app.include_router(exporting_router)
    app.include_router(service_router)
    app.include_router(video_router)
    app.include_router(public_router)
    app.dependency_overrides.clear()

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    return app


def test_admin_routes_require_authentication() -> None:
    db_path = _db_path()
    engine = create_engine(f"sqlite:///{db_path}", future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()

    try:
        client = TestClient(_build_app(session))

        assert client.get("/channels/apps").status_code == 401
        assert client.get("/conversation/conversations").status_code == 401
        assert client.get("/exporting/tasks").status_code == 401
        assert client.get("/service/tickets").status_code == 401
        assert client.get("/video/sessions").status_code == 401
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        if db_path.exists():
            db_path.unlink()


def test_public_h5_routes_remain_available_without_auth() -> None:
    db_path = _db_path()
    engine = create_engine(f"sqlite:///{db_path}", future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()

    try:
        client = TestClient(_build_app(session))

        created_profile = client.post(
            "/public/customer/profiles",
            json={"external_id": "public-001", "name": "Visitor A"},
        )
        assert created_profile.status_code == 201
        customer_id = created_profile.json()["id"]

        created_conversation = client.post(
            "/public/conversation/conversations",
            json={"customer_profile_id": customer_id, "channel": "h5"},
        )
        assert created_conversation.status_code == 201
        conversation_id = created_conversation.json()["id"]

        summary = client.get(f"/public/conversation/conversations/{conversation_id}/summary")
        assert summary.status_code == 200
        assert summary.json()["conversation_id"] == conversation_id

        satisfaction = client.post(
            f"/public/conversation/conversations/{conversation_id}/satisfaction",
            json={"score": 5, "comment": "公开访客满意"},
        )
        assert satisfaction.status_code == 201
        assert satisfaction.json()["score"] == 5

        leave_message = client.post(
            "/public/service/leave-messages",
            json={
                "visitor_name": "访客",
                "source": "h5",
                "subject": "公开留言",
                "content": "请回电",
            },
        )
        assert leave_message.status_code == 201
        assert leave_message.json()["subject"] == "公开留言"
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        if db_path.exists():
            db_path.unlink()
