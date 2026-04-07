from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
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
    label: Mapped[str] = Column(String(255), nullable=False)
    note: Mapped[str | None] = Column(Text, nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    session: Mapped[VideoSession] = relationship("VideoSession", back_populates="snapshots")

