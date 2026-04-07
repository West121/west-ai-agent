from __future__ import annotations

from fastapi import FastAPI
from sqlalchemy.orm import Session

from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import Permission, Role, User
from app.modules.auth.security import hash_password


def seed_authenticated_user(
    db_session: Session,
    *,
    username: str = "admin-test",
    permissions: list[str] | None = None,
) -> User:
    granted_permissions = permissions or ["platform.read"]
    permission_models = [Permission(name=name) for name in granted_permissions]
    role = Role(name=f"{username}-role", permissions=permission_models)
    user = User(
        username=username,
        password_hash=hash_password("secret"),
        role=role,
        is_active=True,
    )
    db_session.add_all([*permission_models, role, user])
    db_session.commit()
    db_session.refresh(user)
    return user


def override_authenticated_user(app: FastAPI, user: User) -> None:
    def _override_get_current_user() -> User:
        return user

    app.dependency_overrides[get_current_user] = _override_get_current_user
