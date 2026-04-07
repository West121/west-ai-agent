from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.conversation.crud import _load_conversation
from app.modules.customer.crud import _load_customer, list_customer_profiles
from app.modules.service.crud import create_ticket, get_ticket
from app.modules.service.schemas import TicketCreate
from app.modules.video.models import VideoSession, VideoSnapshot
from app.modules.video.schemas import (
    VideoSessionEnd,
    VideoSessionRead,
    VideoSessionStart,
    VideoSessionSummaryUpsert,
    VideoSessionTransferTicket,
    VideoSnapshotCreate,
    VideoRecordingCreate,
    VideoRecordingRead,
    VideoRecordingRetentionUpdate,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _not_found(resource: str, identifier: int) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{resource} {identifier} not found")


def _load_video_session(db: Session, session_id: int) -> VideoSession:
    stmt = select(VideoSession).options(selectinload(VideoSession.snapshots)).where(VideoSession.id == session_id)
    session = db.scalars(stmt).first()
    if session is None:
        raise _not_found("video session", session_id)
    return session


def _load_current_video_session(db: Session) -> VideoSession | None:
    stmt = (
        select(VideoSession)
        .options(selectinload(VideoSession.snapshots))
        .where(VideoSession.status == "active")
        .order_by(VideoSession.started_at.desc(), VideoSession.id.desc())
    )
    return db.scalars(stmt).first()


def _session_read(session: VideoSession) -> VideoSessionRead:
    snapshots = [snapshot for snapshot in session.snapshots if snapshot.entry_type == "snapshot"]
    recordings = [
        snapshot
        for snapshot in session.snapshots
        if snapshot.entry_type == "recording" and snapshot.retention_state != "deleted"
    ]
    latest_snapshot_at = max((snapshot.created_at for snapshot in snapshots), default=None)
    latest_recording_at = max((snapshot.recorded_at or snapshot.created_at for snapshot in recordings), default=None)
    return VideoSessionRead(
        id=session.id,
        customer_profile_id=session.customer_profile_id,
        conversation_id=session.conversation_id,
        assignee=session.assignee,
        status=session.status,
        ticket_id=session.ticket_id,
        ai_summary=session.ai_summary,
        operator_summary=session.operator_summary,
        issue_category=session.issue_category,
        resolution=session.resolution,
        next_action=session.next_action,
        handoff_reason=session.handoff_reason,
        follow_up_required=session.follow_up_required,
        summary_updated_at=session.summary_updated_at,
        started_at=session.started_at,
        ended_at=session.ended_at,
        ended_reason=session.ended_reason,
        created_at=session.created_at,
        updated_at=session.updated_at,
        snapshot_count=len(snapshots),
        latest_snapshot_at=latest_snapshot_at,
        recording_count=len(recordings),
        latest_recording_at=latest_recording_at,
    )


def _recording_read(recording: VideoSnapshot) -> VideoRecordingRead:
    return VideoRecordingRead(
        id=recording.id,
        session_id=recording.session_id,
        entry_type=recording.entry_type,
        label=recording.label,
        note=recording.note,
        file_key=recording.file_key,
        file_name=recording.file_name,
        mime_type=recording.mime_type,
        duration_seconds=recording.duration_seconds,
        playback_url=recording.playback_url or f"/video/recordings/{recording.id}/playback",
        retention_state=recording.retention_state,
        retention_reason=recording.retention_reason,
        retained_at=recording.retained_at,
        deleted_at=recording.deleted_at,
        recorded_at=recording.recorded_at or recording.created_at,
        created_at=recording.created_at,
    )


def _first_customer_id(db: Session) -> int:
    customer = list_customer_profiles(db)
    if not customer:
        raise HTTPException(status_code=404, detail="No customer profiles available for video session")
    return customer[0].id


def list_video_sessions(db: Session) -> list[VideoSession]:
    stmt = (
        select(VideoSession)
        .options(selectinload(VideoSession.snapshots))
        .order_by(VideoSession.started_at.desc(), VideoSession.id.desc())
    )
    return list(db.scalars(stmt).all())


def get_current_video_session(db: Session) -> VideoSession | None:
    return _load_current_video_session(db)


def get_video_session(db: Session, session_id: int) -> VideoSession:
    return _load_video_session(db, session_id)


def start_video_session(db: Session, data: VideoSessionStart) -> VideoSession:
    current_session = _load_current_video_session(db)
    if current_session is not None:
        return current_session

    customer_profile_id = data.customer_profile_id
    conversation_id = data.conversation_id

    if conversation_id is not None:
        conversation = _load_conversation(db, conversation_id)
        if customer_profile_id is None:
            customer_profile_id = conversation.customer_profile_id
        elif customer_profile_id != conversation.customer_profile_id:
            raise HTTPException(status_code=400, detail="conversation customer does not match customer_profile_id")

    if customer_profile_id is None:
        customer_profile_id = _first_customer_id(db)

    _load_customer(db, customer_profile_id)

    session = VideoSession(
        customer_profile_id=customer_profile_id,
        conversation_id=conversation_id,
        assignee=data.assignee,
        status="active",
        started_at=utcnow(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    db.refresh(session, attribute_names=["snapshots"])
    return session


def end_video_session(db: Session, session_id: int, data: VideoSessionEnd) -> VideoSession:
    session = _load_video_session(db, session_id)
    if session.status == "ended":
        raise HTTPException(status_code=409, detail="video session is already ended")

    session.status = "ended"
    session.ended_at = utcnow()
    session.ended_reason = data.reason
    db.commit()
    db.refresh(session)
    db.refresh(session, attribute_names=["snapshots"])
    return session


def list_video_snapshots(db: Session, session_id: int) -> list[VideoSnapshot]:
    _load_video_session(db, session_id)
    stmt = (
        select(VideoSnapshot)
        .where(VideoSnapshot.entry_type == "snapshot")
        .where(VideoSnapshot.session_id == session_id)
        .order_by(VideoSnapshot.created_at.desc(), VideoSnapshot.id.desc())
    )
    return list(db.scalars(stmt).all())


def _load_session_recordings(db: Session, session_id: int) -> list[VideoSnapshot]:
    _load_video_session(db, session_id)
    stmt = (
        select(VideoSnapshot)
        .where(VideoSnapshot.entry_type == "recording")
        .where(VideoSnapshot.session_id == session_id)
        .order_by(VideoSnapshot.created_at.desc(), VideoSnapshot.id.desc())
    )
    return list(db.scalars(stmt).all())


def list_video_recordings(
    db: Session,
    session_id: int,
    retention_state: str | None = "retained",
    keyword: str | None = None,
) -> list[VideoSnapshot]:
    recordings = _load_session_recordings(db, session_id)
    filtered = recordings
    if retention_state and retention_state != "all":
        filtered = [recording for recording in filtered if recording.retention_state == retention_state]
    if keyword and keyword.strip():
        lowered = keyword.strip().lower()
        filtered = [
            recording
            for recording in filtered
            if lowered in recording.label.lower()
            or lowered in (recording.note or "").lower()
            or lowered in (recording.file_name or "").lower()
            or lowered in (recording.retention_reason or "").lower()
        ]
    return filtered


def get_video_recording(db: Session, recording_id: int) -> VideoSnapshot:
    stmt = select(VideoSnapshot).where(
        VideoSnapshot.id == recording_id,
        VideoSnapshot.entry_type == "recording",
    )
    recording = db.scalars(stmt).first()
    if recording is None:
        raise _not_found("video recording", recording_id)
    return recording


def update_video_recording_retention(
    db: Session,
    recording_id: int,
    data: VideoRecordingRetentionUpdate,
) -> VideoSnapshot:
    recording = get_video_recording(db, recording_id)
    retention_state = data.retention_state
    reason = data.reason.strip() if data.reason and data.reason.strip() else None

    if retention_state == "deleted":
        recording.retention_state = "deleted"
        recording.retention_reason = reason
        recording.deleted_at = utcnow()
    else:
        recording.retention_state = "retained"
        recording.retention_reason = None
        recording.retained_at = utcnow()
        recording.deleted_at = None

    db.commit()
    db.refresh(recording)
    return recording


def video_recordings_overview(db: Session, session_id: int) -> dict[str, int]:
    recordings = _load_session_recordings(db, session_id)
    retained_count = sum(1 for recording in recordings if recording.retention_state != "deleted")
    deleted_count = sum(1 for recording in recordings if recording.retention_state == "deleted")
    return {
        "total_count": len(recordings),
        "retained_count": retained_count,
        "deleted_count": deleted_count,
    }


def create_video_snapshot(db: Session, session_id: int, data: VideoSnapshotCreate) -> VideoSnapshot:
    session = _load_video_session(db, session_id)
    if session.status == "ended":
        raise HTTPException(status_code=409, detail="video session is already ended")

    snapshot_count = sum(1 for snapshot in session.snapshots if snapshot.entry_type == "snapshot")
    snapshot = VideoSnapshot(
        session_id=session_id,
        entry_type="snapshot",
        label=data.label.strip() if data.label and data.label.strip() else f"抓拍 {snapshot_count + 1}",
        note=data.note.strip() if data.note and data.note.strip() else None,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    db.refresh(session)
    db.refresh(session, attribute_names=["snapshots"])
    return snapshot


def create_video_recording(db: Session, session_id: int, data: VideoRecordingCreate) -> VideoSnapshot:
    session = _load_video_session(db, session_id)
    if session.status == "ended":
        raise HTTPException(status_code=409, detail="video session is already ended")

    recording_count = sum(1 for snapshot in session.snapshots if snapshot.entry_type == "recording")
    recording = VideoSnapshot(
        session_id=session_id,
        entry_type="recording",
        label=data.label.strip() if data.label and data.label.strip() else f"录制 {recording_count + 1}",
        note=data.note.strip() if data.note and data.note.strip() else None,
        file_key=data.file_key.strip() if data.file_key and data.file_key.strip() else None,
        file_name=data.file_name.strip() if data.file_name and data.file_name.strip() else None,
        mime_type=data.mime_type.strip() if data.mime_type and data.mime_type.strip() else None,
        duration_seconds=data.duration_seconds,
        playback_url=data.playback_url.strip() if data.playback_url and data.playback_url.strip() else None,
        retention_state="retained",
        retained_at=utcnow(),
        recorded_at=utcnow(),
    )
    db.add(recording)
    db.flush()
    if recording.playback_url is None:
        recording.playback_url = f"/video/recordings/{recording.id}/playback"
    db.commit()
    db.refresh(recording)
    db.refresh(session)
    db.refresh(session, attribute_names=["snapshots"])
    return recording


def update_video_session_summary(db: Session, session_id: int, data: VideoSessionSummaryUpsert) -> VideoSession:
    session = _load_video_session(db, session_id)
    payload = data.model_dump(exclude_unset=True)
    if "ai_summary" in payload and payload["ai_summary"] is not None:
        session.ai_summary = payload["ai_summary"].strip() or session.ai_summary
    if "operator_summary" in payload:
        session.operator_summary = payload["operator_summary"].strip() if payload["operator_summary"] else None
    if "issue_category" in payload:
        session.issue_category = payload["issue_category"].strip() if payload["issue_category"] else None
    if "resolution" in payload:
        session.resolution = payload["resolution"].strip() if payload["resolution"] else None
    if "next_action" in payload:
        session.next_action = payload["next_action"].strip() if payload["next_action"] else None
    if "handoff_reason" in payload:
        session.handoff_reason = payload["handoff_reason"].strip() if payload["handoff_reason"] else None
    if "follow_up_required" in payload:
        session.follow_up_required = bool(payload["follow_up_required"])
    session.summary_updated_at = utcnow()
    session.updated_at = utcnow()
    db.commit()
    db.refresh(session)
    db.refresh(session, attribute_names=["snapshots"])
    return session


def transfer_video_session_ticket(db: Session, session_id: int, data: VideoSessionTransferTicket):
    session = _load_video_session(db, session_id)
    if session.status == "ended":
        raise HTTPException(status_code=409, detail="video session is already ended")

    if session.ticket_id is not None:
        return get_ticket(db, session.ticket_id)

    title = data.title.strip() if data.title and data.title.strip() else f"视频会话 #{session_id} 工单"
    summary = data.summary.strip() if data.summary and data.summary.strip() else f"来自视频客服会话 #{session_id} 的转工单记录"
    ticket = create_ticket(
        db,
        TicketCreate(
            title=title,
            status=data.status,
            priority=data.priority,
            source=data.source,
            customer_profile_id=session.customer_profile_id,
            conversation_id=session.conversation_id,
            assignee=data.assignee,
            assignee_group=data.assignee_group,
            summary=summary,
        ),
    )
    session.ticket_id = ticket.id
    session.updated_at = utcnow()
    db.commit()
    db.refresh(session)
    db.refresh(session, attribute_names=["snapshots"])
    return ticket
