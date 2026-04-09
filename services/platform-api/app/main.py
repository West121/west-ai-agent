from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from time import sleep

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

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
from app.modules.voice.models import VoiceAudioAsset, VoiceHandoffRecord, VoiceSession, VoiceTranscriptSegment

settings = get_settings()
DEFAULT_JWT_SECRET = "dev-secret-for-platform-api-please-change"


def ensure_schema() -> None:
    import app.models  # noqa: F401

    last_error: Exception | None = None
    for attempt in range(1, settings.app_database_startup_retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            repair_legacy_schema()
            return
        except OperationalError as error:
            last_error = error
            if attempt >= settings.app_database_startup_retries:
                break
            sleep(settings.app_database_startup_retry_delay_seconds)

    if last_error is not None:
        raise last_error


def repair_legacy_schema() -> None:
    inspector = inspect(engine)
    table_repairs = {
        "video_sessions": {
            "ticket_id": "INTEGER",
            "ai_summary": "TEXT NOT NULL DEFAULT '暂无摘要'",
            "operator_summary": "TEXT",
            "issue_category": "VARCHAR(255)",
            "resolution": "TEXT",
            "next_action": "TEXT",
            "handoff_reason": "TEXT",
            "follow_up_required": "BOOLEAN NOT NULL DEFAULT FALSE",
            "summary_updated_at": "TIMESTAMP",
        },
        "video_snapshots": {
            "entry_type": "VARCHAR(32) NOT NULL DEFAULT 'snapshot'",
            "file_key": "VARCHAR(255)",
            "file_name": "VARCHAR(255)",
            "mime_type": "VARCHAR(128)",
            "duration_seconds": "INTEGER",
            "playback_url": "VARCHAR(1024)",
            "retention_state": "VARCHAR(32) NOT NULL DEFAULT 'retained'",
            "retention_reason": "TEXT",
            "retained_at": "TIMESTAMP",
            "deleted_at": "TIMESTAMP",
            "recorded_at": "TIMESTAMP",
        },
    }

    with engine.begin() as connection:
        for table_name, columns in table_repairs.items():
            if not inspector.has_table(table_name):
                continue
            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, definition in columns.items():
                if column_name in existing_columns:
                    continue
                connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"))


def validate_runtime_settings() -> None:
    if settings.is_production and settings.app_jwt_secret == DEFAULT_JWT_SECRET:
        raise RuntimeError("APP_JWT_SECRET must be overridden in production mode.")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    validate_runtime_settings()
    ensure_schema()
    if settings.bootstrap_default_admin:
        seed_default_admin()
    if settings.bootstrap_sample_data:
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
        required_permission_names = [
            "platform.read",
            "customer.read",
            "customer.write",
            "knowledge.read",
            "knowledge.write",
            "channel.read",
            "channel.write",
            "conversation.read",
            "conversation.write",
            "service.read",
            "service.write",
            "video.read",
            "video.write",
            "export.read",
            "export.write",
            "voice.read",
            "voice.write",
        ]
        existing_permissions = {
            permission.name: permission for permission in session.query(Permission).all()
        }
        permissions = []
        for name in required_permission_names:
            permission = existing_permissions.get(name)
            if permission is None:
                permission = Permission(name=name)
                session.add(permission)
                existing_permissions[name] = permission
            permissions.append(permission)

        admin_role = session.query(Role).filter(Role.name == "admin").one_or_none()
        if admin_role is None:
            admin_role = Role(name="admin")
            session.add(admin_role)

        granted_names = {permission.name for permission in admin_role.permissions}
        for permission in permissions:
            if permission.name not in granted_names:
                admin_role.permissions.append(permission)

        existing = session.query(User).filter(User.username == settings.app_default_admin_username).one_or_none()
        if existing is None:
            admin_user = User(
                username=settings.app_default_admin_username,
                password_hash=hash_password(settings.app_default_admin_password),
                role=admin_role,
                is_active=True,
            )
            session.add(admin_user)
        else:
            existing.role = admin_role
            existing.is_active = True
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
