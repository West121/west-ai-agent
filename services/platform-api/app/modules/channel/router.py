from __future__ import annotations

from urllib.parse import urljoin

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.modules.channel.dependencies import get_db
from app.modules.channel.models import ChannelApp
from app.modules.channel.schemas import ChannelAppCreate, ChannelAppListOut, ChannelAppOut, H5LinkOut, H5LinkRequest

router = APIRouter(prefix="/channels", tags=["channels"])


def _serialize(channel_app: ChannelApp) -> ChannelAppOut:
    return ChannelAppOut(
        id=channel_app.id,
        name=channel_app.name,
        code=channel_app.code,
        base_url=channel_app.base_url,
        is_active=channel_app.is_active,
    )


@router.get("/apps", response_model=ChannelAppListOut)
def list_channel_apps(db: Session = Depends(get_db)) -> ChannelAppListOut:
    items = db.query(ChannelApp).order_by(ChannelApp.id.asc()).all()
    return ChannelAppListOut(items=[_serialize(item) for item in items])


@router.post("/apps", response_model=ChannelAppOut, status_code=status.HTTP_201_CREATED)
def create_channel_app(payload: ChannelAppCreate, db: Session = Depends(get_db)) -> ChannelAppOut:
    existing = db.query(ChannelApp).filter(ChannelApp.code == payload.code).one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Channel app code already exists")

    channel_app = ChannelApp(name=payload.name, code=payload.code, base_url=payload.base_url)
    db.add(channel_app)
    db.commit()
    db.refresh(channel_app)
    return _serialize(channel_app)


@router.post("/apps/{channel_app_id}/h5-link", response_model=H5LinkOut)
def create_h5_link(
    channel_app_id: int,
    payload: H5LinkRequest,
    db: Session = Depends(get_db),
) -> H5LinkOut:
    channel_app = db.query(ChannelApp).filter(ChannelApp.id == channel_app_id).one_or_none()
    if channel_app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel app not found")

    normalized_path = payload.path if payload.path.startswith("/") else f"/{payload.path}"
    h5_url = urljoin(channel_app.base_url.rstrip("/") + "/", normalized_path.lstrip("/"))
    return H5LinkOut(channel_app_id=channel_app.id, path=normalized_path, h5_url=h5_url)

