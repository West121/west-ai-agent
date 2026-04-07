from collections.abc import Generator
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.db import Base
from app.modules.customer.models import CustomerProfile
from app.modules.service.router import router as service_router
from app.testing.auth_utils import override_authenticated_user, seed_authenticated_user


def _db_path() -> Path:
    return Path("/tmp/platform_api_service_test.db")


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


def test_ticket_and_leave_message_flow() -> None:
    db_path = _db_path()
    engine = create_engine(f"sqlite:///{db_path}", future=True)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()

    try:
      customer = CustomerProfile(external_id="ext-service-001", name="Service User")
      session.add(customer)
      session.commit()
      session.refresh(customer)

      client = TestClient(_build_app(session))

      created_ticket = client.post(
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
              "sla_due_at": "2026-04-06T10:00:00Z",
          },
      )
      assert created_ticket.status_code == 201
      assert created_ticket.json()["title"] == "退款工单"

      listing = client.get("/service/tickets")
      assert listing.status_code == 200
      assert listing.json()["items"][0]["priority"] == "high"

      created_leave_message = client.post(
          "/service/leave-messages",
          json={
              "visitor_name": "张晓晴",
              "phone": "13800000000",
              "email": "zxq@example.com",
              "source": "h5",
              "status": "pending",
              "subject": "售后跟进",
              "content": "希望客服回访退货进度",
              "assigned_group": "售后组",
          },
      )
      assert created_leave_message.status_code == 201
      assert created_leave_message.json()["visitor_name"] == "张晓晴"

      leave_messages = client.get("/service/leave-messages")
      assert leave_messages.status_code == 200
      assert leave_messages.json()["items"][0]["subject"] == "售后跟进"
    finally:
      session.close()
      Base.metadata.drop_all(bind=engine)
      if db_path.exists():
          db_path.unlink()
