from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped

from app.core.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ExportTask(Base):
    __tablename__ = "export_tasks"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    name: Mapped[str] = Column(String(255), nullable=False)
    source_kind: Mapped[str] = Column(String(64), nullable=False, index=True)
    format: Mapped[str] = Column(String(32), nullable=False, default="csv")
    status: Mapped[str] = Column(String(32), nullable=False, default="pending", index=True)
    row_count: Mapped[int | None] = Column(Integer, nullable=True)
    download_url: Mapped[str | None] = Column(String(1024), nullable=True)
    last_error: Mapped[str | None] = Column(Text, nullable=True)
    started_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
