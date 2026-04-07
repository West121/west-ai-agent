from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TagBase(BaseModel):
    name: str = Field(min_length=1, max_length=128)


class TagCreate(TagBase):
    pass


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)


class TagRead(TagBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class CustomerProfileBase(BaseModel):
    external_id: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    status: str = Field(default="active", max_length=32)
    tag_ids: list[int] = Field(default_factory=list)


class CustomerProfileCreate(CustomerProfileBase):
    pass


class CustomerProfileUpdate(BaseModel):
    external_id: str | None = Field(default=None, min_length=1, max_length=128)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    status: str | None = Field(default=None, max_length=32)
    tag_ids: list[int] | None = None


class CustomerProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    external_id: str
    name: str
    email: str | None
    phone: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    tags: list[TagRead] = Field(default_factory=list)


class BlacklistBase(BaseModel):
    customer_profile_id: int | None = None
    value: str = Field(min_length=1, max_length=255)
    reason: str | None = None


class BlacklistCreate(BlacklistBase):
    pass


class BlacklistUpdate(BaseModel):
    customer_profile_id: int | None = None
    value: str | None = Field(default=None, min_length=1, max_length=255)
    reason: str | None = None


class BlacklistRead(BlacklistBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class BlacklistListResponse(BaseModel):
    items: list[BlacklistRead]
