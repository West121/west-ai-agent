from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class KnowledgeDocumentCreate(BaseModel):
    tenant_id: str = Field(min_length=1, max_length=128)
    type: str = Field(min_length=1, max_length=32)
    title: str = Field(min_length=1, max_length=255)
    category: str = Field(min_length=1, max_length=128)
    tags: list[str] = Field(default_factory=list)
    language: str = Field(default="zh-CN", max_length=32)
    channels: list[str] = Field(default_factory=list)
    content: str | None = None


class KnowledgeDocumentImportRequest(KnowledgeDocumentCreate):
    pass


class KnowledgeDocumentReviewRequest(BaseModel):
    pass


class PublishVersionRequest(BaseModel):
    publish_version: int = Field(ge=1)


class KnowledgeIndexTaskResultRead(BaseModel):
    document_id: int
    task_id: str
    status: str
    indexed_chunk_count: int
    indexed_at: datetime
    result: dict[str, Any]


class KnowledgeDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: str
    type: str
    title: str
    source_kind: str
    status: str
    category: str
    tags: list[str]
    language: str
    channels: list[str]
    version: int
    publish_version: int | None
    content: str | None
    index_status: str
    indexed_chunk_count: int
    last_indexed_at: datetime | None
    last_index_task_id: str | None
    last_index_error: str | None
    last_index_result: dict[str, Any] | None
    imported_at: datetime | None
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
