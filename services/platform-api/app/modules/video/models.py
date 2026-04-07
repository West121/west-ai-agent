from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, relationship

from app.core.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class VideoSession(Base):
    __tablename__ = "video_sessions"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    customer_profile_id: Mapped[int] = Column(
        Integer,
        ForeignKey("customer_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    conversation_id: Mapped[int | None] = Column(
        Integer,
        ForeignKey("conversations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assignee: Mapped[str | None] = Column(String(255), nullable=True, index=True)
    status: Mapped[str] = Column(String(32), nullable=False, default="active", index=True)
    ticket_id: Mapped[int | None] = Column(
        Integer,
        ForeignKey("service_tickets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ai_summary: Mapped[str] = Column(Text, nullable=False, default="暂无摘要")
    operator_summary: Mapped[str | None] = Column(Text, nullable=True)
    issue_category: Mapped[str | None] = Column(String(255), nullable=True, index=True)
    resolution: Mapped[str | None] = Column(Text, nullable=True)
    next_action: Mapped[str | None] = Column(Text, nullable=True)
    handoff_reason: Mapped[str | None] = Column(Text, nullable=True)
    follow_up_required: Mapped[bool] = Column(Boolean, nullable=False, default=False)
    summary_updated_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    ended_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    ended_reason: Mapped[str | None] = Column(Text, nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    customer_profile = relationship("CustomerProfile", lazy="selectin")
    conversation = relationship("Conversation", lazy="selectin")
    ticket = relationship("Ticket", lazy="selectin")
    snapshots: Mapped[list["VideoSnapshot"]] = relationship(
        "VideoSnapshot",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class VideoSnapshot(Base):
    __tablename__ = "video_snapshots"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = Column(
        Integer,
        ForeignKey("video_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entry_type: Mapped[str] = Column(String(32), nullable=False, default="snapshot", index=True)
    label: Mapped[str] = Column(String(255), nullable=False)
    note: Mapped[str | None] = Column(Text, nullable=True)
    file_key: Mapped[str | None] = Column(String(255), nullable=True, index=True)
    file_name: Mapped[str | None] = Column(String(255), nullable=True)
    mime_type: Mapped[str | None] = Column(String(128), nullable=True)
    duration_seconds: Mapped[int | None] = Column(Integer, nullable=True)
    playback_url: Mapped[str | None] = Column(String(1024), nullable=True)
    retention_state: Mapped[str] = Column(String(32), nullable=False, default="retained", index=True)
    retention_reason: Mapped[str | None] = Column(Text, nullable=True)
    retained_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    recorded_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    session: Mapped[VideoSession] = relationship("VideoSession", back_populates="snapshots")
