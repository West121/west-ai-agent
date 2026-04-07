from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.db import Base, SessionLocal, engine
from app.modules.auth.models import Permission, Role, User
from app.modules.channel.models import ChannelApp
from app.modules.conversation.models import Conversation, ConversationSummary
from app.modules.customer.models import CustomerProfile
from app.modules.knowledge.models import KnowledgeDocument
from app.modules.service.models import LeaveMessage, Ticket
from app.modules.auth.security import hash_password

settings = get_settings()


def ensure_schema() -> None:
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    ensure_schema()
    seed_default_admin()
    seed_sample_data()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.app_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)


def seed_default_admin() -> None:
    session = SessionLocal()
    try:
        existing = session.query(User).filter(User.username == settings.app_default_admin_username).one_or_none()
        if existing is not None:
            return

        permissions = [
            Permission(name="platform.read"),
            Permission(name="customer.read"),
            Permission(name="knowledge.read"),
            Permission(name="channel.read"),
            Permission(name="conversation.read"),
        ]
        admin_role = Role(name="admin", permissions=permissions)
        admin_user = User(
            username=settings.app_default_admin_username,
            password_hash=hash_password(settings.app_default_admin_password),
            role=admin_role,
            is_active=True,
        )
        session.add(admin_user)
        session.commit()
    finally:
        session.close()


def seed_sample_data() -> None:
    session = SessionLocal()
    try:
        if session.query(ChannelApp).count() == 0:
            session.add_all(
                [
                    ChannelApp(name="官网客服", code="web_main", base_url="https://support.example.com"),
                    ChannelApp(name="App 内嵌 H5", code="app_h5", base_url="https://app.example.com/service"),
                ]
            )

        if session.query(CustomerProfile).count() == 0:
            session.add_all(
                [
                    CustomerProfile(
                        external_id="seed-customer-001",
                        name="张晓晴",
                        email="zhang@example.com",
                        phone="13800000000",
                    ),
                    CustomerProfile(
                        external_id="seed-customer-002",
                        name="李云舟",
                        email="li@example.com",
                        phone="13900000000",
                    ),
                ]
            )

        if session.query(KnowledgeDocument).count() == 0:
            session.add_all(
                [
                    KnowledgeDocument(
                        tenant_id="default",
                        type="faq",
                        title="退款到账说明",
                        source_kind="imported",
                        status="published",
                        category="售后",
                        tags=["退款", "财务"],
                        language="zh-CN",
                        channels=["web", "h5", "app"],
                        version=1,
                        publish_version=1,
                        content="一般情况下原路退款会在 1 到 3 个工作日到账。",
                        index_status="completed",
                        indexed_chunk_count=1,
                    ),
                    KnowledgeDocument(
                        tenant_id="default",
                        type="article",
                        title="发票补开发票指引",
                        source_kind="manual",
                        status="draft",
                        category="财务",
                        tags=["发票"],
                        language="zh-CN",
                        channels=["web"],
                        version=1,
                        content="补开发票需要提供订单号和抬头信息。",
                        index_status="idle",
                    ),
                ]
            )

        session.flush()

        if session.query(Conversation).count() == 0:
            first_customer = session.query(CustomerProfile).order_by(CustomerProfile.id.asc()).first()
            if first_customer is not None:
                conversation = Conversation(
                    customer_profile_id=first_customer.id,
                    channel="app",
                    assignee="agent-seed",
                    status="open",
                )
                session.add(conversation)
                session.flush()
                session.add(
                    ConversationSummary(
                        conversation_id=conversation.id,
                        ai_summary="用户咨询退款到账时效，已命中退款 FAQ，等待人工确认。",
                        message_count=3,
                    )
                )

        session.flush()

        if session.query(Ticket).count() == 0:
            first_customer = session.query(CustomerProfile).order_by(CustomerProfile.id.asc()).first()
            first_conversation = session.query(Conversation).order_by(Conversation.id.asc()).first()
            session.add(
                Ticket(
                    title="退款到账跟进",
                    status="open",
                    priority="high",
                    source="app",
                    customer_profile_id=first_customer.id if first_customer else None,
                    conversation_id=first_conversation.id if first_conversation else None,
                    assignee="agent-seed",
                    assignee_group="售后组",
                    summary="用户希望确认退款到账时间。",
                )
            )

        if session.query(LeaveMessage).count() == 0:
            session.add(
                LeaveMessage(
                    visitor_name="王晨曦",
                    phone="13700000000",
                    email="wang@example.com",
                    source="h5",
                    status="pending",
                    subject="账号冻结反馈",
                    content="希望客服联系我处理账号冻结问题。",
                    assigned_group="客服一组",
                )
            )

        session.commit()
    finally:
        session.close()


def main() -> None:
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=False,
    )
