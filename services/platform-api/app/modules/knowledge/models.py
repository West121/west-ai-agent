from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped

from app.core.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)
    tenant_id: Mapped[str] = Column(String(128), nullable=False, index=True)
    type: Mapped[str] = Column(String(32), nullable=False, index=True)
    title: Mapped[str] = Column(String(255), nullable=False)
    status: Mapped[str] = Column(String(32), nullable=False, default="draft", index=True)
    category: Mapped[str] = Column(String(128), nullable=False, index=True)
    tags: Mapped[list[str]] = Column(JSON, nullable=False, default=list)
    language: Mapped[str] = Column(String(32), nullable=False, default="zh-CN")
    channels: Mapped[list[str]] = Column(JSON, nullable=False, default=list)
    version: Mapped[int] = Column(Integer, nullable=False, default=1)
    publish_version: Mapped[int | None] = Column(Integer, nullable=True)
    content: Mapped[str | None] = Column(Text, nullable=True)
    source_kind: Mapped[str] = Column(String(32), nullable=False, default="manual")
    index_status: Mapped[str] = Column(String(32), nullable=False, default="idle")
    indexed_chunk_count: Mapped[int] = Column(Integer, nullable=False, default=0)
    last_indexed_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    last_index_task_id: Mapped[str | None] = Column(String(128), nullable=True)
    last_index_error: Mapped[str | None] = Column(Text, nullable=True)
    last_index_result: Mapped[dict | None] = Column(JSON, nullable=True)
    imported_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    published_at: Mapped[datetime | None] = Column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
