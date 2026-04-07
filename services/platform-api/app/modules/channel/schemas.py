from __future__ import annotations

from pydantic import BaseModel


class ChannelAppCreate(BaseModel):
    name: str
    code: str
    base_url: str


class ChannelAppOut(BaseModel):
    id: int
    name: str
    code: str
    base_url: str
    is_active: bool


class ChannelAppListOut(BaseModel):
    items: list[ChannelAppOut]


class H5LinkRequest(BaseModel):
    path: str = "/"


class H5LinkOut(BaseModel):
    channel_app_id: int
    path: str
    h5_url: str
