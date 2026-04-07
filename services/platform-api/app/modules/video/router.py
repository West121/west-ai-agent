from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.auth.dependencies import require_permissions
from app.modules.service.schemas import TicketRead
from app.modules.video.crud import (
    _session_read,
    create_video_snapshot,
    end_video_session,
    get_current_video_session,
    list_video_sessions,
    list_video_snapshots,
    start_video_session,
    transfer_video_session_ticket,
)
from app.modules.video.schemas import (
    VideoSessionEnd,
    VideoSessionListResponse,
    VideoSessionRead,
    VideoSessionStart,
    VideoSessionTransferTicket,
    VideoSnapshotCreate,
    VideoSnapshotListResponse,
    VideoSnapshotRead,
)

router = APIRouter(prefix="/video", tags=["video"])


@router.get("/sessions", response_model=VideoSessionListResponse)
def get_video_sessions(
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("video.read")),
) -> VideoSessionListResponse:
    return VideoSessionListResponse(items=[_session_read(session) for session in list_video_sessions(db)])


@router.get("/sessions/current", response_model=VideoSessionRead | None)
def get_current_video_session_detail(
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("video.read")),
) -> VideoSessionRead | None:
    session = get_current_video_session(db)
    return _session_read(session) if session is not None else None


@router.post("/sessions/start", response_model=VideoSessionRead, status_code=status.HTTP_201_CREATED)
def post_start_video_session(
    payload: VideoSessionStart,
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("video.write")),
) -> VideoSessionRead:
    return _session_read(start_video_session(db, payload))


@router.post("/sessions/{session_id}/end", response_model=VideoSessionRead)
def post_end_video_session(
    session_id: int,
    payload: VideoSessionEnd,
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("video.write")),
) -> VideoSessionRead:
    return _session_read(end_video_session(db, session_id, payload))


@router.get("/sessions/{session_id}/snapshots", response_model=VideoSnapshotListResponse)
def get_video_snapshots(
    session_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("video.read")),
) -> VideoSnapshotListResponse:
    return VideoSnapshotListResponse(
        items=[VideoSnapshotRead.model_validate(snapshot) for snapshot in list_video_snapshots(db, session_id)]
    )


@router.post("/sessions/{session_id}/snapshots", response_model=VideoSnapshotRead, status_code=status.HTTP_201_CREATED)
def post_video_snapshot(
    session_id: int,
    payload: VideoSnapshotCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("video.write")),
) -> VideoSnapshotRead:
    return VideoSnapshotRead.model_validate(create_video_snapshot(db, session_id, payload))


@router.post("/sessions/{session_id}/transfer-ticket", response_model=TicketRead, status_code=status.HTTP_201_CREATED)
def post_transfer_ticket(
    session_id: int,
    payload: VideoSessionTransferTicket,
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("video.write")),
) -> TicketRead:
    return TicketRead.model_validate(transfer_video_session_ticket(db, session_id, payload))
