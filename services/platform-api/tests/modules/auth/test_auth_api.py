from collections.abc import Generator

import jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings
from app.core.db import Base
from app.modules.auth.dependencies import get_current_user, get_db
from app.modules.auth.models import Permission, Role, User
from app.modules.auth.router import router as auth_router
from app.modules.auth.security import hash_password


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)

    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def app(db_session: Session) -> FastAPI:
    permission = Permission(name="channel.read")
    role = Role(name="admin", permissions=[permission])
    user = User(
        username="alice",
        password_hash=hash_password("secret"),
        role=role,
    )
    db_session.add_all([permission, role, user])
    db_session.commit()
    db_session.refresh(user)

    application = FastAPI()
    application.include_router(auth_router)

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    application.dependency_overrides[get_db] = override_get_db
    return application


def test_login_returns_jwt_and_user_permissions(app: FastAPI) -> None:
    client = TestClient(app)

    response = client.post("/auth/login", json={"username": "alice", "password": "secret"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["token_type"] == "bearer"
    assert payload["user"]["username"] == "alice"
    assert payload["user"]["role"]["name"] == "admin"
    assert payload["permissions"] == ["channel.read"]
    decoded = jwt.decode(
        payload["access_token"],
        get_settings().app_jwt_secret,
        algorithms=[get_settings().app_jwt_algorithm],
    )
    assert decoded["sub"] == str(payload["user"]["id"])


def test_current_user_permissions_requires_valid_token(app: FastAPI) -> None:
    client = TestClient(app)
    login = client.post("/auth/login", json={"username": "alice", "password": "secret"}).json()

    response = client.get(
        "/auth/me/permissions",
        headers={"Authorization": f"Bearer {login['access_token']}"},
    )

    assert response.status_code == 200
    assert response.json()["permissions"] == ["channel.read"]
    assert response.json()["user"]["username"] == "alice"


def test_list_users_returns_seeded_users(app: FastAPI) -> None:
    client = TestClient(app)
    login = client.post("/auth/login", json={"username": "alice", "password": "secret"}).json()

    response = client.get(
        "/auth/users",
        headers={"Authorization": f"Bearer {login['access_token']}"},
    )

    assert response.status_code == 200
    assert response.json()["items"][0]["username"] == "alice"
