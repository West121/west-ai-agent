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
    VideoSessionTransferTicket,
    VideoSnapshotCreate,
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
    latest_snapshot_at = max((snapshot.created_at for snapshot in session.snapshots), default=None)
    return VideoSessionRead(
        id=session.id,
        customer_profile_id=session.customer_profile_id,
        conversation_id=session.conversation_id,
        assignee=session.assignee,
        status=session.status,
        ticket_id=session.ticket_id,
        started_at=session.started_at,
        ended_at=session.ended_at,
        ended_reason=session.ended_reason,
        created_at=session.created_at,
        updated_at=session.updated_at,
        snapshot_count=len(session.snapshots),
        latest_snapshot_at=latest_snapshot_at,
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
        .where(VideoSnapshot.session_id == session_id)
        .order_by(VideoSnapshot.created_at.desc(), VideoSnapshot.id.desc())
    )
    return list(db.scalars(stmt).all())


def create_video_snapshot(db: Session, session_id: int, data: VideoSnapshotCreate) -> VideoSnapshot:
    session = _load_video_session(db, session_id)
    if session.status == "ended":
        raise HTTPException(status_code=409, detail="video session is already ended")

    snapshot_count = len(session.snapshots)
    snapshot = VideoSnapshot(
        session_id=session_id,
        label=data.label.strip() if data.label and data.label.strip() else f"抓拍 {snapshot_count + 1}",
        note=data.note.strip() if data.note and data.note.strip() else None,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    db.refresh(session)
    db.refresh(session, attribute_names=["snapshots"])
    return snapshot


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
