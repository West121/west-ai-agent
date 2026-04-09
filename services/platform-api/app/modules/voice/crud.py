from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.conversation.crud import _load_conversation
from app.modules.customer.crud import _load_customer
from app.modules.voice.models import (
    VoiceAudioAsset,
    VoiceHandoffRecord,
    VoiceSession,
    VoiceTranscriptSegment,
)
from app.modules.voice.schemas import (
    VoiceAudioAssetCreate,
    VoiceHandoffCreate,
    VoiceSessionCreate,
    VoiceSessionRead,
    VoiceTranscriptSegmentCreate,
)


def _not_found(resource: str, identifier: int) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{resource} {identifier} not found")


def _load_voice_session(db: Session, voice_session_id: int) -> VoiceSession:
    stmt = (
        select(VoiceSession)
        .options(
            selectinload(VoiceSession.transcripts),
            selectinload(VoiceSession.audio_assets),
            selectinload(VoiceSession.handoff_records),
        )
        .where(VoiceSession.id == voice_session_id)
    )
    session = db.scalars(stmt).first()
    if session is None:
        raise _not_found("voice session", voice_session_id)
    return session


def _voice_session_read(session: VoiceSession) -> VoiceSessionRead:
    return VoiceSessionRead(
        id=session.id,
        conversation_id=session.conversation_id,
        customer_profile_id=session.customer_profile_id,
        channel=session.channel,
        status=session.status,
        livekit_room=session.livekit_room,
        stt_provider=session.stt_provider,
        finalizer_provider=session.finalizer_provider,
        tts_provider=session.tts_provider,
        handoff_pending=session.handoff_pending,
        transcript_count=len(session.transcripts),
        audio_asset_count=len(session.audio_assets),
        handoff_count=len(session.handoff_records),
        started_at=session.started_at,
        ended_at=session.ended_at,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


def create_voice_session(db: Session, payload: VoiceSessionCreate) -> VoiceSessionRead:
    conversation = _load_conversation(db, payload.conversation_id)
    customer = _load_customer(db, payload.customer_profile_id)
    if conversation.customer_profile_id != customer.id:
        raise HTTPException(status_code=400, detail="conversation customer does not match customer_profile_id")

    session = VoiceSession(
        conversation_id=conversation.id,
        customer_profile_id=customer.id,
        channel=payload.channel,
        status=payload.status,
        livekit_room=payload.livekit_room,
        stt_provider=payload.stt_provider,
        finalizer_provider=payload.finalizer_provider,
        tts_provider=payload.tts_provider,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    db.refresh(session, attribute_names=["transcripts", "audio_assets", "handoff_records"])
    return _voice_session_read(session)


def get_voice_session(db: Session, voice_session_id: int) -> VoiceSessionRead:
    return _voice_session_read(_load_voice_session(db, voice_session_id))


def list_voice_sessions(
    db: Session,
    *,
    conversation_id: int | None = None,
    customer_profile_id: int | None = None,
    status: str | None = None,
) -> list[VoiceSessionRead]:
    stmt = select(VoiceSession).options(
        selectinload(VoiceSession.transcripts),
        selectinload(VoiceSession.audio_assets),
        selectinload(VoiceSession.handoff_records),
    )

    if conversation_id is not None:
        stmt = stmt.where(VoiceSession.conversation_id == conversation_id)
    if customer_profile_id is not None:
        stmt = stmt.where(VoiceSession.customer_profile_id == customer_profile_id)
    if status:
        stmt = stmt.where(VoiceSession.status == status)

    stmt = stmt.order_by(VoiceSession.created_at.desc(), VoiceSession.id.desc())
    return [_voice_session_read(item) for item in db.scalars(stmt).all()]


def list_voice_transcripts(db: Session, voice_session_id: int) -> list[VoiceTranscriptSegment]:
    _load_voice_session(db, voice_session_id)
    stmt = (
        select(VoiceTranscriptSegment)
        .where(VoiceTranscriptSegment.voice_session_id == voice_session_id)
        .order_by(VoiceTranscriptSegment.created_at.asc(), VoiceTranscriptSegment.id.asc())
    )
    return list(db.scalars(stmt).all())


def list_voice_audio_assets(db: Session, voice_session_id: int) -> list[VoiceAudioAsset]:
    _load_voice_session(db, voice_session_id)
    stmt = (
        select(VoiceAudioAsset)
        .where(VoiceAudioAsset.voice_session_id == voice_session_id)
        .order_by(VoiceAudioAsset.created_at.desc(), VoiceAudioAsset.id.desc())
    )
    return list(db.scalars(stmt).all())


def list_voice_handoffs(db: Session, voice_session_id: int) -> list[VoiceHandoffRecord]:
    _load_voice_session(db, voice_session_id)
    stmt = (
        select(VoiceHandoffRecord)
        .where(VoiceHandoffRecord.voice_session_id == voice_session_id)
        .order_by(VoiceHandoffRecord.created_at.desc(), VoiceHandoffRecord.id.desc())
    )
    return list(db.scalars(stmt).all())


def append_voice_transcript(
    db: Session,
    voice_session_id: int,
    payload: VoiceTranscriptSegmentCreate,
) -> VoiceTranscriptSegment:
    _load_voice_session(db, voice_session_id)
    segment = VoiceTranscriptSegment(
        voice_session_id=voice_session_id,
        speaker=payload.speaker,
        text=payload.text.strip(),
        normalized_text=payload.normalized_text.strip() if payload.normalized_text else None,
        is_final=payload.is_final,
        start_ms=payload.start_ms,
        end_ms=payload.end_ms,
    )
    db.add(segment)
    db.commit()
    db.refresh(segment)
    return segment


def create_voice_audio_asset(
    db: Session,
    voice_session_id: int,
    payload: VoiceAudioAssetCreate,
) -> VoiceAudioAsset:
    _load_voice_session(db, voice_session_id)
    asset = VoiceAudioAsset(
        voice_session_id=voice_session_id,
        asset_type=payload.asset_type,
        file_key=payload.file_key,
        mime_type=payload.mime_type,
        duration_ms=payload.duration_ms,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


def create_voice_handoff(
    db: Session,
    voice_session_id: int,
    payload: VoiceHandoffCreate,
) -> VoiceHandoffRecord:
    session = _load_voice_session(db, voice_session_id)
    handoff = VoiceHandoffRecord(
        voice_session_id=voice_session_id,
        reason=payload.reason.strip(),
        summary=payload.summary.strip(),
        handed_off_to=payload.handed_off_to.strip() if payload.handed_off_to else None,
    )
    session.handoff_pending = True
    db.add(handoff)
    db.commit()
    db.refresh(handoff)
    return handoff
