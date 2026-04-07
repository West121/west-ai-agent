from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, relationship

from app.core.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Ticket(Base):
    __tablename__ = "service_tickets"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    title: Mapped[str] = Column(String(255), nullable=False)
    status: Mapped[str] = Column(String(32), nullable=False, default="open", index=True)
    priority: Mapped[str] = Column(String(32), nullable=False, default="normal", index=True)
    source: Mapped[str] = Column(String(64), nullable=False, default="web")
    customer_profile_id: Mapped[int | None] = Column(
        Integer,
        ForeignKey("customer_profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    conversation_id: Mapped[int | None] = Column(
        Integer,
        ForeignKey("conversations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assignee: Mapped[str | None] = Column(String(255), nullable=True, index=True)
    assignee_group: Mapped[str | None] = Column(String(255), nullable=True, index=True)
    summary: Mapped[str | None] = Column(Text, nullable=True)
    sla_due_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    customer_profile = relationship("CustomerProfile", lazy="selectin")
    conversation = relationship("Conversation", lazy="selectin")


class LeaveMessage(Base):
    __tablename__ = "service_leave_messages"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    visitor_name: Mapped[str] = Column(String(255), nullable=False)
    phone: Mapped[str | None] = Column(String(64), nullable=True, index=True)
    email: Mapped[str | None] = Column(String(255), nullable=True, index=True)
    source: Mapped[str] = Column(String(64), nullable=False, default="h5")
    status: Mapped[str] = Column(String(32), nullable=False, default="pending", index=True)
    subject: Mapped[str] = Column(String(255), nullable=False)
    content: Mapped[str] = Column(Text, nullable=False)
    assigned_group: Mapped[str | None] = Column(String(255), nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
