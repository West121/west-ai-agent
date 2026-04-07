from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.auth.dependencies import require_permissions
from app.modules.service.schemas import TicketRead
from app.modules.video.crud import (
    _session_read,
    create_video_snapshot,
    create_video_recording,
    end_video_session,
    get_current_video_session,
    get_video_recording,
    get_video_session,
    list_video_sessions,
    list_video_recordings,
    list_video_snapshots,
    start_video_session,
    update_video_session_summary,
    transfer_video_session_ticket,
)
from app.modules.video.storage import get_video_object_storage
from app.modules.video.schemas import (
    VideoSessionEnd,
    VideoSessionListResponse,
    VideoSessionRead,
    VideoSessionSummaryUpsert,
    VideoSessionStart,
    VideoSessionTransferTicket,
    VideoRecordingCreate,
    VideoRecordingListResponse,
    VideoRecordingRead,
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


@router.get("/sessions/{session_id}/summary", response_model=VideoSessionRead)
def get_video_session_summary(
    session_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("video.read")),
) -> VideoSessionRead:
    return _session_read(get_video_session(db, session_id))


@router.post("/sessions/{session_id}/summary", response_model=VideoSessionRead)
def post_video_session_summary(
    session_id: int,
    payload: VideoSessionSummaryUpsert,
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("video.write")),
) -> VideoSessionRead:
    return _session_read(update_video_session_summary(db, session_id, payload))


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


@router.get("/sessions/{session_id}/recordings", response_model=VideoRecordingListResponse)
def get_video_recordings(
    session_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("video.read")),
) -> VideoRecordingListResponse:
    return VideoRecordingListResponse(
        items=[VideoRecordingRead.model_validate(recording) for recording in list_video_recordings(db, session_id)]
    )


@router.post("/sessions/{session_id}/recordings", response_model=VideoRecordingRead, status_code=status.HTTP_201_CREATED)
def post_video_recording(
    session_id: int,
    payload: VideoRecordingCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("video.write")),
) -> VideoRecordingRead:
    return VideoRecordingRead.model_validate(create_video_recording(db, session_id, payload))


@router.post("/sessions/{session_id}/recordings/upload", response_model=VideoRecordingRead, status_code=status.HTTP_201_CREATED)
async def upload_video_recording(
    session_id: int,
    file: UploadFile = File(...),
    label: str | None = Form(default=None),
    note: str | None = Form(default=None),
    duration_seconds: int | None = Form(default=None),
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("video.write")),
) -> VideoRecordingRead:
    payload = await file.read()
    file_name = file.filename or f"session-{session_id}.webm"
    extension = file_name.rsplit(".", 1)[-1] if "." in file_name else "webm"
    file_key = f"video-recordings/session-{session_id}/{uuid4().hex}.{extension}"
    storage = get_video_object_storage()
    stored = storage.store(
        file_key=file_key,
        file_name=file_name,
        content_type=file.content_type or "video/webm",
        data=payload,
    )
    recording = create_video_recording(
        db,
        session_id,
        VideoRecordingCreate(
            label=label,
            note=note,
            file_key=stored.file_key,
            file_name=stored.file_name,
            mime_type=stored.mime_type,
            duration_seconds=duration_seconds,
        ),
    )
    return VideoRecordingRead.model_validate(recording)


@router.get("/recordings/{recording_id}/playback")
def get_video_recording_playback(
    recording_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("video.read")),
) -> StreamingResponse:
    recording = get_video_recording(db, recording_id)
    if not recording.file_key:
        raise HTTPException(status_code=404, detail="recording file not found")
    storage = get_video_object_storage()
    stream, _ = storage.open(recording.file_key)
    media_type = recording.mime_type or "application/octet-stream"
    headers = {}
    if recording.file_name:
        headers["Content-Disposition"] = f'inline; filename="{recording.file_name}"'
    return StreamingResponse(stream, media_type=media_type, headers=headers)


@router.post("/sessions/{session_id}/transfer-ticket", response_model=TicketRead, status_code=status.HTTP_201_CREATED)
def post_transfer_ticket(
    session_id: int,
    payload: VideoSessionTransferTicket,
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("video.write")),
) -> TicketRead:
    return TicketRead.model_validate(transfer_video_session_ticket(db, session_id, payload))
