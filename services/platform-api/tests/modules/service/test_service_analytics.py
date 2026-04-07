from collections.abc import Generator
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import Base
from app.modules.customer.models import CustomerProfile
from app.modules.service.models import LeaveMessage, Ticket
from app.modules.service.router import router as service_router
from app.testing.auth_utils import override_authenticated_user, seed_authenticated_user


def _build_app(db_session: Session) -> FastAPI:
    app = FastAPI()
    app.include_router(service_router)
    app.dependency_overrides.clear()

    from app.core.db import get_db

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    user = seed_authenticated_user(db_session, permissions=["service.read", "service.write"])
    override_authenticated_user(app, user)
    return app


def test_service_analytics_overview_aggregates_trends_distributions_durations_and_hit_rates() -> None:
    db_path = Path("/tmp/platform_api_service_analytics_test.db")
    engine = create_engine(f"sqlite:///{db_path}", future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()

    now = datetime.now(timezone.utc)
    recent_day = now - timedelta(days=1)
    older_day = now - timedelta(days=2)

    try:
        customer = CustomerProfile(external_id="ext-service-analytics-001", name="Service Alpha")
        session.add(customer)
        session.commit()
        session.refresh(customer)

        client = TestClient(_build_app(session))

        open_ticket = client.post(
            "/service/tickets",
            json={
                "title": "退款工单",
                "status": "open",
                "priority": "high",
                "source": "app",
                "customer_profile_id": customer.id,
                "conversation_id": None,
                "assignee": "agent-a",
                "assignee_group": "售后组",
                "summary": "用户咨询退款到账时效",
                "sla_due_at": (now + timedelta(hours=4)).isoformat(),
            },
        )
        resolved_ticket = client.post(
            "/service/tickets",
            json={
                "title": "物流问题",
                "status": "resolved",
                "priority": "low",
                "source": "web",
                "customer_profile_id": customer.id,
                "conversation_id": None,
                "assignee": None,
                "assignee_group": None,
                "summary": "已处理",
                "sla_due_at": (now - timedelta(hours=2)).isoformat(),
            },
        )
        pending_leave = client.post(
            "/service/leave-messages",
            json={
                "visitor_name": "王晓",
                "phone": "13800000001",
                "email": "wang@example.com",
                "source": "h5",
                "status": "pending",
                "subject": "回访请求",
                "content": "请尽快回访。",
                "assigned_group": None,
            },
        )
        handled_leave = client.post(
            "/service/leave-messages",
            json={
                "visitor_name": "赵雷",
                "phone": "13800000002",
                "email": "zhao@example.com",
                "source": "app",
                "status": "handled",
                "subject": "发票咨询",
                "content": "请补开发票。",
                "assigned_group": "财务组",
            },
        )

        open_ticket_id = open_ticket.json()["id"]
        resolved_ticket_id = resolved_ticket.json()["id"]
        pending_leave_id = pending_leave.json()["id"]
        handled_leave_id = handled_leave.json()["id"]

        open_ticket_row = session.get(Ticket, open_ticket_id)
        resolved_ticket_row = session.get(Ticket, resolved_ticket_id)
        pending_leave_row = session.get(LeaveMessage, pending_leave_id)
        handled_leave_row = session.get(LeaveMessage, handled_leave_id)
        assert open_ticket_row is not None
        assert resolved_ticket_row is not None
        assert pending_leave_row is not None
        assert handled_leave_row is not None

        open_ticket_row.created_at = recent_day.replace(hour=9, minute=0, second=0, microsecond=0)
        open_ticket_row.updated_at = open_ticket_row.created_at + timedelta(hours=3)
        resolved_ticket_row.created_at = older_day.replace(hour=13, minute=0, second=0, microsecond=0)
        resolved_ticket_row.updated_at = resolved_ticket_row.created_at + timedelta(hours=1)
        pending_leave_row.created_at = recent_day.replace(hour=10, minute=0, second=0, microsecond=0)
        pending_leave_row.updated_at = pending_leave_row.created_at + timedelta(hours=2)
        handled_leave_row.created_at = older_day.replace(hour=15, minute=0, second=0, microsecond=0)
        handled_leave_row.updated_at = handled_leave_row.created_at + timedelta(hours=1)
        session.commit()

        response = client.get("/service/analytics/overview", params={"window_days": 7})
        assert response.status_code == 200
        payload = response.json()

        trend = {item["date"]: item for item in payload["trend"]}
        assert payload["window_days"] == 7
        assert trend[recent_day.date().isoformat()]["ticket_count"] == 1
        assert trend[recent_day.date().isoformat()]["leave_message_count"] == 1
        assert trend[older_day.date().isoformat()]["ticket_count"] == 1
        assert trend[older_day.date().isoformat()]["leave_message_count"] == 1

        ticket_status = {item["label"]: item["value"] for item in payload["distribution"]["ticket_status"]}
        ticket_priority = {item["label"]: item["value"] for item in payload["distribution"]["ticket_priority"]}
        leave_status = {item["label"]: item["value"] for item in payload["distribution"]["leave_message_status"]}
        assert ticket_status["open"] == 1
        assert ticket_status["resolved"] == 1
        assert ticket_priority["high"] == 1
        assert ticket_priority["low"] == 1
        assert leave_status["pending"] == 1
        assert leave_status["handled"] == 1

        expected_open_ticket_age = round((now - open_ticket_row.created_at).total_seconds() / 60, 0)
        expected_pending_leave_age = round((now - pending_leave_row.created_at).total_seconds() / 60, 0)
        assert payload["duration"]["open_ticket_average_age_minutes"] == pytest.approx(expected_open_ticket_age, abs=1)
        assert payload["duration"]["pending_leave_message_average_age_minutes"] == pytest.approx(
            expected_pending_leave_age,
            abs=1,
        )
        assert payload["hit_rate"]["ticket_assignment_rate"] == 50.0
        assert payload["hit_rate"]["sla_compliance_rate"] == 50.0
        assert payload["hit_rate"]["leave_assignment_rate"] == 50.0

        filtered_response = client.get(
            "/service/analytics/overview",
            params={"window_days": 7, "ticket_status": "open", "leave_message_status": "pending"},
        )
        assert filtered_response.status_code == 200
        filtered_payload = filtered_response.json()
        filtered_trend = filtered_payload["trend"]
        assert len(filtered_trend) == 1
        assert filtered_trend[0]["ticket_count"] == 1
        assert filtered_trend[0]["leave_message_count"] == 1
        filtered_ticket_status = {item["label"]: item["value"] for item in filtered_payload["distribution"]["ticket_status"]}
        filtered_leave_status = {item["label"]: item["value"] for item in filtered_payload["distribution"]["leave_message_status"]}
        assert filtered_ticket_status["open"] == 1
        assert filtered_leave_status["pending"] == 1
        assert filtered_payload["duration"]["ticket_count"] == 1
        assert filtered_payload["duration"]["leave_message_count"] == 1
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        if db_path.exists():
            db_path.unlink()
