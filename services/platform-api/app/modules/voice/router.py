from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.auth.dependencies import require_permissions
from app.modules.voice.crud import (
    append_voice_transcript,
    create_voice_audio_asset,
    create_voice_handoff,
    create_voice_session,
    get_voice_session,
    list_voice_audio_assets,
    list_voice_handoffs,
    list_voice_sessions,
    list_voice_transcripts,
)
from app.modules.voice.schemas import (
    VoiceAudioAssetCreate,
    VoiceAudioAssetListResponse,
    VoiceAudioAssetRead,
    VoiceHandoffCreate,
    VoiceHandoffListResponse,
    VoiceHandoffRead,
    VoiceSessionCreate,
    VoiceSessionListResponse,
    VoiceSessionRead,
    VoiceTranscriptListResponse,
    VoiceTranscriptSegmentCreate,
    VoiceTranscriptSegmentRead,
)

router = APIRouter(prefix="/voice", tags=["voice"])


@router.get("/sessions", response_model=VoiceSessionListResponse)
def get_voice_sessions(
    conversation_id: int | None = Query(default=None),
    customer_profile_id: int | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    _: object = Depends(require_permissions("voice.read")),
    db: Session = Depends(get_db),
) -> VoiceSessionListResponse:
    return VoiceSessionListResponse(
        items=list_voice_sessions(
            db,
            conversation_id=conversation_id,
            customer_profile_id=customer_profile_id,
            status=status_filter,
        )
    )


@router.post("/sessions", response_model=VoiceSessionRead, status_code=status.HTTP_201_CREATED)
def post_voice_session(
    payload: VoiceSessionCreate,
    _: object = Depends(require_permissions("voice.write")),
    db: Session = Depends(get_db),
) -> VoiceSessionRead:
    return create_voice_session(db, payload)


@router.get("/sessions/{voice_session_id}", response_model=VoiceSessionRead)
def get_voice_session_detail(
    voice_session_id: int,
    _: object = Depends(require_permissions("voice.read")),
    db: Session = Depends(get_db),
) -> VoiceSessionRead:
    return get_voice_session(db, voice_session_id)


@router.post("/sessions/{voice_session_id}/transcripts", response_model=VoiceTranscriptSegmentRead, status_code=status.HTTP_201_CREATED)
def post_voice_transcript(
    voice_session_id: int,
    payload: VoiceTranscriptSegmentCreate,
    _: object = Depends(require_permissions("voice.write")),
    db: Session = Depends(get_db),
) -> VoiceTranscriptSegmentRead:
    return VoiceTranscriptSegmentRead.model_validate(append_voice_transcript(db, voice_session_id, payload))


@router.get("/sessions/{voice_session_id}/transcripts", response_model=VoiceTranscriptListResponse)
def get_voice_transcripts(
    voice_session_id: int,
    _: object = Depends(require_permissions("voice.read")),
    db: Session = Depends(get_db),
) -> VoiceTranscriptListResponse:
    return VoiceTranscriptListResponse(
        items=[VoiceTranscriptSegmentRead.model_validate(item) for item in list_voice_transcripts(db, voice_session_id)]
    )


@router.get("/sessions/{voice_session_id}/assets", response_model=VoiceAudioAssetListResponse)
def get_voice_audio_assets(
    voice_session_id: int,
    _: object = Depends(require_permissions("voice.read")),
    db: Session = Depends(get_db),
) -> VoiceAudioAssetListResponse:
    return VoiceAudioAssetListResponse(
        items=[VoiceAudioAssetRead.model_validate(item) for item in list_voice_audio_assets(db, voice_session_id)]
    )


@router.post("/sessions/{voice_session_id}/assets", response_model=VoiceAudioAssetRead, status_code=status.HTTP_201_CREATED)
def post_voice_audio_asset(
    voice_session_id: int,
    payload: VoiceAudioAssetCreate,
    _: object = Depends(require_permissions("voice.write")),
    db: Session = Depends(get_db),
) -> VoiceAudioAssetRead:
    return VoiceAudioAssetRead.model_validate(create_voice_audio_asset(db, voice_session_id, payload))


@router.post("/sessions/{voice_session_id}/handoff", response_model=VoiceHandoffRead, status_code=status.HTTP_201_CREATED)
def post_voice_handoff(
    voice_session_id: int,
    payload: VoiceHandoffCreate,
    _: object = Depends(require_permissions("voice.write")),
    db: Session = Depends(get_db),
) -> VoiceHandoffRead:
    return VoiceHandoffRead.model_validate(create_voice_handoff(db, voice_session_id, payload))


@router.get("/sessions/{voice_session_id}/handoff", response_model=VoiceHandoffListResponse)
def get_voice_handoffs(
    voice_session_id: int,
    _: object = Depends(require_permissions("voice.read")),
    db: Session = Depends(get_db),
) -> VoiceHandoffListResponse:
    return VoiceHandoffListResponse(
        items=[VoiceHandoffRead.model_validate(item) for item in list_voice_handoffs(db, voice_session_id)]
    )
