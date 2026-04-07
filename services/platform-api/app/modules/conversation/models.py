from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, relationship

from app.core.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    customer_profile_id: Mapped[int] = Column(
        Integer,
        ForeignKey("customer_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    channel: Mapped[str] = Column(String(64), nullable=False, default="web")
    assignee: Mapped[str | None] = Column(String(255), nullable=True, index=True)
    status: Mapped[str] = Column(String(32), nullable=False, default="open")
    ended_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    customer_profile = relationship("CustomerProfile", lazy="selectin")
    events: Mapped[list["ConversationEvent"]] = relationship(
        "ConversationEvent",
        back_populates="conversation",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    summary: Mapped["ConversationSummary | None"] = relationship(
        "ConversationSummary",
        back_populates="conversation",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="selectin",
    )
    satisfaction: Mapped["SatisfactionRecord | None"] = relationship(
        "SatisfactionRecord",
        back_populates="conversation",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="selectin",
    )


class ConversationEvent(Base):
    __tablename__ = "conversation_events"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    conversation_id: Mapped[int] = Column(
        Integer,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = Column(String(32), nullable=False, index=True)
    from_assignee: Mapped[str | None] = Column(String(255), nullable=True)
    to_assignee: Mapped[str | None] = Column(String(255), nullable=True)
    reason: Mapped[str | None] = Column(Text, nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    conversation: Mapped[Conversation] = relationship("Conversation", back_populates="events")


class ConversationSummary(Base):
    __tablename__ = "conversation_summaries"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    conversation_id: Mapped[int] = Column(
        Integer,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    ai_summary: Mapped[str] = Column(Text, nullable=False, default="暂无摘要")
    message_count: Mapped[int] = Column(Integer, nullable=False, default=0)
    last_message_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    conversation: Mapped[Conversation] = relationship("Conversation", back_populates="summary")


class SatisfactionRecord(Base):
    __tablename__ = "conversation_satisfaction_records"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    conversation_id: Mapped[int] = Column(
        Integer,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    score: Mapped[int] = Column(Integer, nullable=False)
    comment: Mapped[str | None] = Column(Text, nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    conversation: Mapped[Conversation] = relationship("Conversation", back_populates="satisfaction")
