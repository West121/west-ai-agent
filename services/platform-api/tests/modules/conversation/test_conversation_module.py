from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import Base
from app.modules.conversation.models import Conversation, ConversationEvent
from app.modules.conversation.router import router as conversation_router
from app.modules.customer.models import CustomerProfile


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    db_path = Path("/tmp/platform_api_conversation_test.db")
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
    app.include_router(conversation_router)
    app.dependency_overrides.clear()

    from app.core.db import get_db

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def test_create_transfer_and_end_conversation(client: TestClient, db_session: Session) -> None:
    customer = CustomerProfile(external_id="ext-900", name="Delta")
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    created = client.post(
        "/conversation/conversations",
        json={"customer_profile_id": customer.id, "assignee": "agent-a"},
    )
    assert created.status_code == 201
    conversation_id = created.json()["id"]

    transferred = client.post(
        f"/conversation/conversations/{conversation_id}/transfer",
        json={"assignee": "agent-b", "reason": "shift handoff"},
    )
    assert transferred.status_code == 200
    assert transferred.json()["assignee"] == "agent-b"

    ended = client.post(f"/conversation/conversations/{conversation_id}/end", json={"reason": "resolved"})
    assert ended.status_code == 200
    assert ended.json()["status"] == "ended"


def test_conversation_events_are_recorded(client: TestClient, db_session: Session) -> None:
    customer = CustomerProfile(external_id="ext-901", name="Echo")
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    created = client.post("/conversation/conversations", json={"customer_profile_id": customer.id})
    conversation_id = created.json()["id"]
    client.post(f"/conversation/conversations/{conversation_id}/transfer", json={"assignee": "agent-z"})
    client.post(f"/conversation/conversations/{conversation_id}/end", json={})

    conversation = db_session.get(Conversation, conversation_id)
    events = db_session.query(ConversationEvent).filter_by(conversation_id=conversation_id).all()

    assert conversation is not None
    assert conversation.status == "ended"
    assert [event.event_type for event in events] == ["created", "transferred", "ended"]


def test_history_summary_and_satisfaction_flow(client: TestClient, db_session: Session) -> None:
    customer = CustomerProfile(external_id="ext-902", name="Foxtrot")
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    created = client.post(
        "/conversation/conversations",
        json={"customer_profile_id": customer.id, "assignee": "agent-c", "channel": "h5"},
    )
    assert created.status_code == 201
    conversation_id = created.json()["id"]

    summary = client.get(f"/conversation/conversations/{conversation_id}/summary")
    assert summary.status_code == 200
    assert summary.json()["conversation_id"] == conversation_id
    assert summary.json()["message_count"] == 1

    satisfaction = client.post(
        f"/conversation/conversations/{conversation_id}/satisfaction",
        json={"score": 5, "comment": "问题已解决"},
    )
    assert satisfaction.status_code == 201
    assert satisfaction.json()["score"] == 5

    history = client.get("/conversation/conversations/history")
    assert history.status_code == 200
    assert history.json()["items"][0]["channel"] == "h5"
    assert history.json()["items"][0]["satisfaction_score"] == 5
