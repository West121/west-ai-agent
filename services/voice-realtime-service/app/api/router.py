from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.orchestrator.voice_orchestrator import VoiceTurnResult
from app.session.service import VoiceSessionBootstrap, VoiceSessionService

router = APIRouter()


class VoiceSessionStartRequest(BaseModel):
    conversation_id: int
    customer_profile_id: int
    livekit_room: str | None = None


class VoicePartialRequest(BaseModel):
    transcript_text: str = Field(min_length=1)
    speaker: str = "customer"


class VoiceFinalizeRequest(BaseModel):
    conversation_id: int
    transcript_text: str = Field(min_length=1)


class VoiceTurnResponse(BaseModel):
    decision: str
    transcript: str
    normalized_text: str
    answer: str | None
    clarification: str | None
    handoff: bool
    audio_mime_type: str | None
    audio_duration_ms: int | None


def _turn_response(result: VoiceTurnResult) -> VoiceTurnResponse:
    return VoiceTurnResponse(
        decision=result.decision,
        transcript=result.transcript,
        normalized_text=result.normalized_text,
        answer=result.answer,
        clarification=result.clarification,
        handoff=result.handoff,
        audio_mime_type=result.audio.mime_type if result.audio is not None else None,
        audio_duration_ms=result.audio.duration_ms if result.audio is not None else None,
    )


def get_voice_session_service() -> VoiceSessionService:
    return VoiceSessionService()


@router.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/providers")
def providers() -> dict[str, str]:
    settings = get_settings()
    return {
        "realtime_stt": settings.realtime_stt_provider,
        "finalizer": settings.finalizer_provider,
        "tts": settings.tts_provider,
    }


@router.post("/sessions/start")
async def start_voice_session(
    request: VoiceSessionStartRequest,
    service: VoiceSessionService = Depends(get_voice_session_service),
) -> VoiceSessionBootstrap:
    return await service.start_session(
        conversation_id=request.conversation_id,
        customer_profile_id=request.customer_profile_id,
        livekit_room=request.livekit_room,
    )


@router.post("/sessions/{voice_session_id}/partial")
async def append_partial_transcript(
    voice_session_id: int,
    request: VoicePartialRequest,
    service: VoiceSessionService = Depends(get_voice_session_service),
) -> dict[str, object]:
    return await service.append_partial(
        voice_session_id=voice_session_id,
        transcript_text=request.transcript_text,
        speaker=request.speaker,
    )


@router.post("/sessions/{voice_session_id}/finalize", response_model=VoiceTurnResponse)
async def finalize_transcript(
    voice_session_id: int,
    request: VoiceFinalizeRequest,
    service: VoiceSessionService = Depends(get_voice_session_service),
) -> VoiceTurnResponse:
    result = await service.finalize_turn(
        voice_session_id=voice_session_id,
        conversation_id=request.conversation_id,
        transcript_text=request.transcript_text,
    )
    return _turn_response(result)
