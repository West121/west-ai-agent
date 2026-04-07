from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ExportSourceKind = Literal["tickets", "leave_messages", "conversation_history", "knowledge_documents"]


class ExportTaskCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    source_kind: ExportSourceKind
    format: str = Field(default="csv", max_length=32)


class ExportTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    source_kind: str
    format: str
    status: str
    row_count: int | None
    download_url: str | None
    last_error: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ExportDownloadRead(BaseModel):
    task_id: int
    name: str
    source_kind: str
    format: str
    status: str
    row_count: int
    download_url: str
    generated_at: datetime
