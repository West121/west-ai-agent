from __future__ import annotations

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class PermissionOut(BaseModel):
    name: str


class RoleOut(BaseModel):
    id: int
    name: str
    permissions: list[PermissionOut]


class UserOut(BaseModel):
    id: int
    username: str
    role: RoleOut | None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    permissions: list[str]


class CurrentPermissionsOut(BaseModel):
    user: UserOut
    permissions: list[str]


class UserListOut(BaseModel):
    items: list[UserOut]
