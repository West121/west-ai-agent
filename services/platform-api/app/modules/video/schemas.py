from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VideoSessionStart(BaseModel):
    customer_profile_id: int | None = None
    conversation_id: int | None = None
    assignee: str | None = Field(default=None, max_length=255)


class VideoSessionEnd(BaseModel):
    reason: str | None = None


class VideoSessionTransferTicket(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    status: str = Field(default="open", max_length=32)
    priority: str = Field(default="normal", max_length=32)
    source: str = Field(default="video", max_length=64)
    assignee: str | None = Field(default=None, max_length=255)
    assignee_group: str | None = Field(default=None, max_length=255)
    summary: str | None = None


class VideoSnapshotCreate(BaseModel):
    label: str | None = Field(default=None, max_length=255)
    note: str | None = None


class VideoSnapshotRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    label: str
    note: str | None
    created_at: datetime


class VideoSnapshotListResponse(BaseModel):
    items: list[VideoSnapshotRead]


class VideoSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_profile_id: int
    conversation_id: int | None
    assignee: str | None
    status: str
    ticket_id: int | None
    started_at: datetime
    ended_at: datetime | None
    ended_reason: str | None
    created_at: datetime
    updated_at: datetime
    snapshot_count: int
    latest_snapshot_at: datetime | None


class VideoSessionListResponse(BaseModel):
    items: list[VideoSessionRead]

