from collections.abc import Generator
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import Base
from app.modules.conversation.models import Conversation, ConversationEvent, ConversationSummary, SatisfactionRecord
from app.modules.conversation.router import router as conversation_router
from app.modules.customer.models import CustomerProfile
from app.testing.auth_utils import override_authenticated_user, seed_authenticated_user


def _build_app(db_session: Session) -> FastAPI:
    app = FastAPI()
    app.include_router(conversation_router)
    app.dependency_overrides.clear()

    from app.core.db import get_db

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    user = seed_authenticated_user(db_session, permissions=["conversation.read", "conversation.write"])
    override_authenticated_user(app, user)
    return app


def test_conversation_analytics_overview_aggregates_trends_distributions_durations_and_hit_rates() -> None:
    db_path = Path("/tmp/platform_api_conversation_analytics_test.db")
    engine = create_engine(f"sqlite:///{db_path}", future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()

    now = datetime.now(timezone.utc)
    day_1 = now - timedelta(days=2)
    day_2 = now - timedelta(days=1)

    try:
        customer_1 = CustomerProfile(external_id="ext-analytics-001", name="Alpha")
        customer_2 = CustomerProfile(external_id="ext-analytics-002", name="Beta")
        customer_3 = CustomerProfile(external_id="ext-analytics-003", name="Gamma")
        session.add_all([customer_1, customer_2, customer_3])
        session.commit()
        session.refresh(customer_1)
        session.refresh(customer_2)
        session.refresh(customer_3)

        client = TestClient(_build_app(session))

        first = client.post(
            "/conversation/conversations",
            json={"customer_profile_id": customer_1.id, "channel": "web", "assignee": "agent-a"},
        )
        second = client.post(
            "/conversation/conversations",
            json={"customer_profile_id": customer_2.id, "channel": "app", "assignee": "agent-b"},
        )
        third = client.post(
            "/conversation/conversations",
            json={"customer_profile_id": customer_3.id, "channel": "web", "assignee": "agent-c"},
        )

        first_id = first.json()["id"]
        second_id = second.json()["id"]
        third_id = third.json()["id"]

        client.post(f"/conversation/conversations/{first_id}/transfer", json={"assignee": "agent-z", "reason": "handoff"})
        client.post(f"/conversation/conversations/{first_id}/end", json={"reason": "resolved"})
        client.post(f"/conversation/conversations/{second_id}/transfer", json={"assignee": "agent-y", "reason": "shift change"})
        client.post(f"/conversation/conversations/{third_id}/end", json={"reason": "archived"})

        first_conversation = session.get(Conversation, first_id)
        second_conversation = session.get(Conversation, second_id)
        third_conversation = session.get(Conversation, third_id)
        assert first_conversation is not None
        assert second_conversation is not None
        assert third_conversation is not None

        first_conversation.created_at = day_1.replace(hour=8, minute=0, second=0, microsecond=0)
        first_conversation.updated_at = first_conversation.created_at + timedelta(minutes=30)
        first_conversation.ended_at = first_conversation.created_at + timedelta(minutes=30)
        second_conversation.created_at = day_2.replace(hour=9, minute=0, second=0, microsecond=0)
        second_conversation.updated_at = second_conversation.created_at + timedelta(minutes=20)
        third_conversation.created_at = (now - timedelta(days=9)).replace(hour=10, minute=0, second=0, microsecond=0)
        third_conversation.updated_at = third_conversation.created_at + timedelta(minutes=12)
        third_conversation.ended_at = third_conversation.created_at + timedelta(minutes=12)

        first_summary = session.query(ConversationSummary).filter_by(conversation_id=first_id).one()
        second_summary = session.query(ConversationSummary).filter_by(conversation_id=second_id).one()
        third_summary = session.query(ConversationSummary).filter_by(conversation_id=third_id).one()
        first_summary.ai_summary = "退款知识已命中"
        first_summary.message_count = 4
        first_summary.last_message_at = first_conversation.updated_at
        second_summary.ai_summary = "继续跟进"
        second_summary.message_count = 2
        second_summary.last_message_at = second_conversation.updated_at
        third_summary.ai_summary = "归档"
        third_summary.message_count = 1
        third_summary.last_message_at = third_conversation.updated_at

        first_events = session.query(ConversationEvent).filter_by(conversation_id=first_id).order_by(ConversationEvent.id).all()
        second_events = session.query(ConversationEvent).filter_by(conversation_id=second_id).order_by(ConversationEvent.id).all()
        third_events = session.query(ConversationEvent).filter_by(conversation_id=third_id).order_by(ConversationEvent.id).all()
        first_events[0].created_at = first_conversation.created_at
        first_events[1].created_at = first_conversation.created_at + timedelta(minutes=10)
        first_events[2].created_at = first_conversation.updated_at
        second_events[0].created_at = second_conversation.created_at
        second_events[1].created_at = second_conversation.created_at + timedelta(minutes=5)
        third_events[0].created_at = third_conversation.created_at
        third_events[1].created_at = third_conversation.updated_at

        first_satisfaction = SatisfactionRecord(conversation_id=first_id, score=5, comment="解决了")
        second_satisfaction = SatisfactionRecord(conversation_id=second_id, score=4, comment="一般")
        session.add_all([first_satisfaction, second_satisfaction])
        session.commit()

        response = client.get("/conversation/analytics/overview", params={"window_days": 7})
        assert response.status_code == 200
        payload = response.json()

        trend = {item["date"]: item for item in payload["trend"]}
        assert payload["window_days"] == 7
        assert trend[first_conversation.created_at.date().isoformat()]["created_count"] == 1
        assert trend[first_conversation.created_at.date().isoformat()]["ended_count"] == 1
        assert trend[first_conversation.created_at.date().isoformat()]["transferred_count"] == 1
        assert trend[second_conversation.created_at.date().isoformat()]["created_count"] == 1
        assert trend[second_conversation.created_at.date().isoformat()]["transferred_count"] == 1

        status_distribution = {item["label"]: item["value"] for item in payload["status_distribution"]}
        channel_distribution = {item["label"]: item["value"] for item in payload["channel_distribution"]}
        assert status_distribution["ended"] == 1
        assert status_distribution["transferred"] == 1
        assert channel_distribution["web"] == 1
        assert channel_distribution["app"] == 1

        assert payload["duration"]["count"] == 1
        assert payload["duration"]["average_minutes"] == 30.0
        assert payload["duration"]["max_minutes"] == 30.0
        assert payload["hit_rate"]["summary_coverage_rate"] == 100.0
        assert payload["hit_rate"]["satisfaction_coverage_rate"] == 100.0
        assert payload["hit_rate"]["satisfaction_high_score_rate"] == 100.0
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        if db_path.exists():
            db_path.unlink()
