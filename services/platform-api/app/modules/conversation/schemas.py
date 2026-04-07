from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ConversationCreate(BaseModel):
    customer_profile_id: int
    channel: str = Field(default="web", max_length=64)
    assignee: str | None = Field(default=None, max_length=255)


class ConversationTransfer(BaseModel):
    assignee: str | None = Field(default=None, max_length=255)
    reason: str | None = None


class ConversationEnd(BaseModel):
    reason: str | None = None


class ConversationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_profile_id: int
    channel: str
    assignee: str | None
    status: str
    ended_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ConversationEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    event_type: str
    from_assignee: str | None
    to_assignee: str | None
    reason: str | None
    created_at: datetime


class ConversationSummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    conversation_id: int
    ai_summary: str
    message_count: int
    last_message_at: datetime | None
    satisfaction_score: int | None = None


class ConversationHistoryItem(BaseModel):
    conversation_id: int = Field(alias="id")
    customer_profile_id: int
    status: str
    assignee: str | None
    channel: str
    summary: str
    last_message_at: datetime | None
    created_at: datetime
    ended_at: datetime | None
    satisfaction_score: int | None = None


class ConversationHistoryListResponse(BaseModel):
    items: list[ConversationHistoryItem]


class SatisfactionCreate(BaseModel):
    score: int = Field(ge=1, le=5)
    comment: str | None = None


class SatisfactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    conversation_id: int
    score: int
    comment: str | None
    created_at: datetime
    updated_at: datetime
