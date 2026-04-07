from __future__ import annotations

from datetime import datetime
from typing import Literal

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
    entry_type: str
    label: str
    note: str | None
    file_key: str | None
    file_name: str | None
    mime_type: str | None
    duration_seconds: int | None
    playback_url: str | None
    recorded_at: datetime | None
    created_at: datetime


class VideoSnapshotListResponse(BaseModel):
    items: list[VideoSnapshotRead]


class VideoRecordingCreate(BaseModel):
    label: str | None = Field(default=None, max_length=255)
    note: str | None = None
    file_key: str | None = Field(default=None, max_length=255)
    file_name: str | None = Field(default=None, max_length=255)
    mime_type: str | None = Field(default=None, max_length=128)
    duration_seconds: int | None = Field(default=None, ge=0)
    playback_url: str | None = Field(default=None, max_length=1024)


class VideoRecordingRead(VideoSnapshotRead):
    retention_state: Literal["retained", "deleted"]
    retention_reason: str | None
    retained_at: datetime | None
    deleted_at: datetime | None


class VideoRecordingListResponse(BaseModel):
    items: list[VideoRecordingRead]
    total_count: int
    retained_count: int
    deleted_count: int
    retention_state: str


class VideoRecordingRetentionUpdate(BaseModel):
    retention_state: Literal["retained", "deleted"]
    reason: str | None = Field(default=None, max_length=1024)


class VideoSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_profile_id: int
    conversation_id: int | None
    assignee: str | None
    status: str
    ticket_id: int | None
    ai_summary: str
    operator_summary: str | None
    issue_category: str | None
    resolution: str | None
    next_action: str | None
    handoff_reason: str | None
    follow_up_required: bool
    summary_updated_at: datetime | None
    started_at: datetime
    ended_at: datetime | None
    ended_reason: str | None
    created_at: datetime
    updated_at: datetime
    snapshot_count: int
    latest_snapshot_at: datetime | None
    recording_count: int
    latest_recording_at: datetime | None


class VideoSessionSummaryUpsert(BaseModel):
    ai_summary: str | None = None
    operator_summary: str | None = None
    issue_category: str | None = Field(default=None, max_length=255)
    resolution: str | None = None
    next_action: str | None = None
    handoff_reason: str | None = None
    follow_up_required: bool | None = None


class VideoSessionListResponse(BaseModel):
    items: list[VideoSessionRead]
