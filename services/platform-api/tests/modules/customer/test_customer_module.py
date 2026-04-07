from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import Base
from app.modules.customer.models import BlacklistEntry, CustomerProfile, Tag
from app.modules.customer.router import router as customer_router
from app.testing.auth_utils import override_authenticated_user, seed_authenticated_user


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    db_path = Path("/tmp/platform_api_customer_test.db")
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
    app = FastAPI()
    app.include_router(customer_router)
    app.dependency_overrides.clear()

    from app.core.db import get_db

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    user = seed_authenticated_user(db_session, permissions=["customer.read", "customer.write"])
    override_authenticated_user(app, user)
    return TestClient(app)


def test_create_customer_profile_and_assign_tags(client: TestClient) -> None:
    tag_response = client.post("/customer/tags", json={"name": "vip"})
    assert tag_response.status_code == 201
    tag_id = tag_response.json()["id"]

    response = client.post(
        "/customer/profiles",
        json={
            "external_id": "ext-001",
            "name": "Alice",
            "email": "alice@example.com",
            "phone": "13800000000",
            "tag_ids": [tag_id],
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["external_id"] == "ext-001"
    assert payload["tags"][0]["name"] == "vip"


def test_update_and_delete_customer_profile(client: TestClient) -> None:
    created = client.post("/customer/profiles", json={"external_id": "ext-002", "name": "Bob"})
    profile_id = created.json()["id"]

    updated = client.patch(f"/customer/profiles/{profile_id}", json={"name": "Bobby"})
    assert updated.status_code == 200
    assert updated.json()["name"] == "Bobby"

    deleted = client.delete(f"/customer/profiles/{profile_id}")
    assert deleted.status_code == 204

    missing = client.get(f"/customer/profiles/{profile_id}")
    assert missing.status_code == 404


def test_blacklist_crud(client: TestClient) -> None:
    profile = client.post("/customer/profiles", json={"external_id": "ext-003", "name": "Cara"}).json()

    blacklisted = client.post(
        "/customer/blacklist",
        json={"customer_profile_id": profile["id"], "value": "fraud@example.com", "reason": "abuse"},
    )
    assert blacklisted.status_code == 201
    blacklist_id = blacklisted.json()["id"]

    response = client.get("/customer/blacklist")
    assert response.status_code == 200
    assert response.json()["items"][0]["value"] == "fraud@example.com"

    deleted = client.delete(f"/customer/blacklist/{blacklist_id}")
    assert deleted.status_code == 204
