from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TicketCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    status: str = Field(default="open", max_length=32)
    priority: str = Field(default="normal", max_length=32)
    source: str = Field(default="web", max_length=64)
    customer_profile_id: int | None = None
    conversation_id: int | None = None
    assignee: str | None = Field(default=None, max_length=255)
    assignee_group: str | None = Field(default=None, max_length=255)
    summary: str | None = None
    sla_due_at: datetime | None = None


class TicketUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    status: str | None = Field(default=None, max_length=32)
    priority: str | None = Field(default=None, max_length=32)
    source: str | None = Field(default=None, max_length=64)
    customer_profile_id: int | None = None
    conversation_id: int | None = None
    assignee: str | None = Field(default=None, max_length=255)
    assignee_group: str | None = Field(default=None, max_length=255)
    summary: str | None = None
    sla_due_at: datetime | None = None


class TicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    status: str
    priority: str
    source: str
    customer_profile_id: int | None
    conversation_id: int | None
    assignee: str | None
    assignee_group: str | None
    summary: str | None
    sla_due_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TicketListResponse(BaseModel):
    items: list[TicketRead]


class LeaveMessageCreate(BaseModel):
    visitor_name: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    email: str | None = Field(default=None, max_length=255)
    source: str = Field(default="h5", max_length=64)
    status: str = Field(default="pending", max_length=32)
    subject: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    assigned_group: str | None = Field(default=None, max_length=255)


class LeaveMessageUpdate(BaseModel):
    visitor_name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    email: str | None = Field(default=None, max_length=255)
    source: str | None = Field(default=None, max_length=64)
    status: str | None = Field(default=None, max_length=32)
    subject: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = Field(default=None, min_length=1)
    assigned_group: str | None = Field(default=None, max_length=255)


class LeaveMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    visitor_name: str
    phone: str | None
    email: str | None
    source: str
    status: str
    subject: str
    content: str
    assigned_group: str | None
    created_at: datetime
    updated_at: datetime


class LeaveMessageListResponse(BaseModel):
    items: list[LeaveMessageRead]
