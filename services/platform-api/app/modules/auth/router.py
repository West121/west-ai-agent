from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.modules.auth.dependencies import get_current_user, get_db
from app.modules.auth.models import Role, User
from app.modules.auth.schemas import (
    CurrentPermissionsOut,
    LoginRequest,
    PermissionOut,
    RoleOut,
    TokenOut,
    UserListOut,
    UserOut,
)
from app.modules.auth.security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _permission_names(user: User) -> list[str]:
    if user.role is None:
        return []
    return [permission.name for permission in user.role.permissions]


def _serialize_user(user: User) -> UserOut:
    role = None
    if user.role is not None:
        role = RoleOut(
            id=user.role.id,
            name=user.role.name,
            permissions=[PermissionOut(name=permission.name) for permission in user.role.permissions],
        )
    return UserOut(id=user.id, username=user.username, role=role)


@router.post("/login", response_model=TokenOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenOut:
    user = (
        db.query(User)
        .options(selectinload(User.role).selectinload(Role.permissions))
        .filter(User.username == payload.username, User.is_active.is_(True))
        .one_or_none()
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    return TokenOut(
        access_token=create_access_token(str(user.id)),
        user=_serialize_user(user),
        permissions=_permission_names(user),
    )


@router.get("/me/permissions", response_model=CurrentPermissionsOut)
def current_permissions(current_user: User = Depends(get_current_user)) -> CurrentPermissionsOut:
    return CurrentPermissionsOut(user=_serialize_user(current_user), permissions=_permission_names(current_user))


@router.get("/users", response_model=UserListOut)
def list_users(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserListOut:
    users = db.query(User).options(selectinload(User.role).selectinload(Role.permissions)).order_by(User.id.asc()).all()
    return UserListOut(items=[_serialize_user(user) for user in users])
