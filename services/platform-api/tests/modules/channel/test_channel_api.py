from collections.abc import Generator

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.db import Base
from app.modules.channel.dependencies import get_db
from app.modules.channel.models import ChannelApp
from app.modules.channel.router import router as channel_router
from app.testing.auth_utils import override_authenticated_user, seed_authenticated_user


def build_test_app(db_session: Session) -> FastAPI:
    application = FastAPI()
    application.include_router(channel_router)

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    application.dependency_overrides[get_db] = override_get_db
    user = seed_authenticated_user(db_session, permissions=["channel.read", "channel.write"])
    override_authenticated_user(application, user)
    return application


def test_channel_list_create_and_h5_link() -> None:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        app = build_test_app(session)
        client = TestClient(app)

        created = client.post(
            "/channels/apps",
            json={"name": "WeChat OA", "code": "wechat_official", "base_url": "https://wx.example.com"},
        )
        assert created.status_code == 201
        assert created.json()["code"] == "wechat_official"

        listing = client.get("/channels/apps")
        assert listing.status_code == 200
        assert listing.json()["items"][0]["name"] == "WeChat OA"

        h5_link = client.post(
            f"/channels/apps/{created.json()['id']}/h5-link",
            json={"path": "/promo/welcome"},
        )
        assert h5_link.status_code == 200
        assert h5_link.json()["h5_url"] == "https://wx.example.com/promo/welcome"
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
