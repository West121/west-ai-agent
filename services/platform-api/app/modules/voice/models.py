from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, relationship

from app.core.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class VoiceSession(Base):
    __tablename__ = "voice_sessions"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    conversation_id: Mapped[int] = Column(
        Integer,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_profile_id: Mapped[int] = Column(
        Integer,
        ForeignKey("customer_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    channel: Mapped[str] = Column(String(64), nullable=False, default="voice")
    status: Mapped[str] = Column(String(32), nullable=False, default="idle", index=True)
    livekit_room: Mapped[str | None] = Column(String(255), nullable=True, unique=True)
    stt_provider: Mapped[str] = Column(String(64), nullable=False, default="sherpa-onnx")
    finalizer_provider: Mapped[str] = Column(String(64), nullable=False, default="funasr")
    tts_provider: Mapped[str] = Column(String(64), nullable=False, default="sherpa-onnx")
    handoff_pending: Mapped[bool] = Column(Boolean, nullable=False, default=False)
    started_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    ended_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    conversation = relationship("Conversation", lazy="selectin")
    customer_profile = relationship("CustomerProfile", lazy="selectin")
    transcripts: Mapped[list["VoiceTranscriptSegment"]] = relationship(
        "VoiceTranscriptSegment",
        back_populates="voice_session",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    audio_assets: Mapped[list["VoiceAudioAsset"]] = relationship(
        "VoiceAudioAsset",
        back_populates="voice_session",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    handoff_records: Mapped[list["VoiceHandoffRecord"]] = relationship(
        "VoiceHandoffRecord",
        back_populates="voice_session",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class VoiceTranscriptSegment(Base):
    __tablename__ = "voice_transcript_segments"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    voice_session_id: Mapped[int] = Column(
        Integer,
        ForeignKey("voice_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    speaker: Mapped[str] = Column(String(32), nullable=False, default="customer", index=True)
    text: Mapped[str] = Column(Text, nullable=False)
    normalized_text: Mapped[str | None] = Column(Text, nullable=True)
    is_final: Mapped[bool] = Column(Boolean, nullable=False, default=False, index=True)
    start_ms: Mapped[int | None] = Column(Integer, nullable=True)
    end_ms: Mapped[int | None] = Column(Integer, nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    voice_session: Mapped[VoiceSession] = relationship("VoiceSession", back_populates="transcripts")


class VoiceAudioAsset(Base):
    __tablename__ = "voice_audio_assets"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    voice_session_id: Mapped[int] = Column(
        Integer,
        ForeignKey("voice_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    asset_type: Mapped[str] = Column(String(32), nullable=False, index=True)
    file_key: Mapped[str] = Column(String(255), nullable=False, index=True)
    mime_type: Mapped[str] = Column(String(128), nullable=False)
    duration_ms: Mapped[int | None] = Column(Integer, nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    voice_session: Mapped[VoiceSession] = relationship("VoiceSession", back_populates="audio_assets")


class VoiceHandoffRecord(Base):
    __tablename__ = "voice_handoff_records"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    voice_session_id: Mapped[int] = Column(
        Integer,
        ForeignKey("voice_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    reason: Mapped[str] = Column(Text, nullable=False)
    summary: Mapped[str] = Column(Text, nullable=False)
    handed_off_to: Mapped[str | None] = Column(String(255), nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)

    voice_session: Mapped[VoiceSession] = relationship("VoiceSession", back_populates="handoff_records")

