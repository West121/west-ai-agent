from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VoiceSessionCreate(BaseModel):
    conversation_id: int
    customer_profile_id: int
    channel: str = "voice"
    status: str = "connecting"
    livekit_room: str | None = None
    stt_provider: str = "sherpa-onnx"
    finalizer_provider: str = "funasr"
    tts_provider: str = "sherpa-onnx"


class VoiceSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    customer_profile_id: int
    channel: str
    status: str
    livekit_room: str | None
    stt_provider: str
    finalizer_provider: str
    tts_provider: str
    handoff_pending: bool
    transcript_count: int
    audio_asset_count: int
    handoff_count: int
    started_at: datetime
    ended_at: datetime | None
    created_at: datetime
    updated_at: datetime


class VoiceTranscriptSegmentCreate(BaseModel):
    speaker: str = Field(default="customer")
    text: str
    normalized_text: str | None = None
    is_final: bool = False
    start_ms: int | None = None
    end_ms: int | None = None


class VoiceTranscriptSegmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    voice_session_id: int
    speaker: str
    text: str
    normalized_text: str | None
    is_final: bool
    start_ms: int | None
    end_ms: int | None
    created_at: datetime


class VoiceTranscriptListResponse(BaseModel):
    items: list[VoiceTranscriptSegmentRead]


class VoiceAudioAssetCreate(BaseModel):
    asset_type: str
    file_key: str
    mime_type: str
    duration_ms: int | None = None


class VoiceAudioAssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    voice_session_id: int
    asset_type: str
    file_key: str
    mime_type: str
    duration_ms: int | None
    created_at: datetime


class VoiceAudioAssetListResponse(BaseModel):
    items: list[VoiceAudioAssetRead]


class VoiceHandoffCreate(BaseModel):
    reason: str
    summary: str
    handed_off_to: str | None = None


class VoiceHandoffRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    voice_session_id: int
    reason: str
    summary: str
    handed_off_to: str | None
    created_at: datetime


class VoiceHandoffListResponse(BaseModel):
    items: list[VoiceHandoffRead]


class VoiceSessionListResponse(BaseModel):
    items: list[VoiceSessionRead]
