from __future__ import annotations

import httpx

from app.core.config import get_settings


class MessageBridge:
    def __init__(self, *, message_gateway_base_url: str | None = None, timeout: float = 10.0) -> None:
        settings = get_settings()
        self.base_url = (message_gateway_base_url or settings.message_gateway_base_url).rstrip("/")
        self.timeout = timeout

    async def append_assistant_message(self, conversation_id: int | str, text: str) -> dict[str, object]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/messages/{conversation_id}",
                json={
                    "sender_id": "ai-voice-bot",
                    "sender_role": "assistant",
                    "text": text,
                },
            )
            response.raise_for_status()
            return response.json()


class RecordingBridge:
    def __init__(self, *, platform_api_base_url: str | None = None, timeout: float = 10.0) -> None:
        settings = get_settings()
        self.base_url = (platform_api_base_url or settings.platform_api_base_url).rstrip("/")
        self.timeout = timeout

    async def create_voice_session(
        self,
        *,
        conversation_id: int,
        customer_profile_id: int,
        channel: str = "voice",
        status: str = "connecting",
        livekit_room: str | None = None,
        stt_provider: str = "sherpa-onnx",
        finalizer_provider: str = "funasr",
        tts_provider: str = "sherpa-onnx",
    ) -> dict[str, object]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/voice/sessions",
                json={
                    "conversation_id": conversation_id,
                    "customer_profile_id": customer_profile_id,
                    "channel": channel,
                    "status": status,
                    "livekit_room": livekit_room,
                    "stt_provider": stt_provider,
                    "finalizer_provider": finalizer_provider,
                    "tts_provider": tts_provider,
                },
                headers={"Authorization": "Bearer dev-internal"},
            )
            response.raise_for_status()
            return response.json()

    async def append_transcript(
        self,
        *,
        voice_session_id: int,
        speaker: str,
        text: str,
        normalized_text: str | None,
        is_final: bool,
        start_ms: int | None = None,
        end_ms: int | None = None,
    ) -> dict[str, object]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/voice/sessions/{voice_session_id}/transcripts",
                json={
                    "speaker": speaker,
                    "text": text,
                    "normalized_text": normalized_text,
                    "is_final": is_final,
                    "start_ms": start_ms,
                    "end_ms": end_ms,
                },
                headers={"Authorization": "Bearer dev-internal"},
            )
            response.raise_for_status()
            return response.json()

    async def create_handoff(
        self,
        *,
        voice_session_id: int,
        reason: str,
        summary: str,
        handed_off_to: str | None = None,
    ) -> dict[str, object]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/voice/sessions/{voice_session_id}/handoff",
                json={
                    "reason": reason,
                    "summary": summary,
                    "handed_off_to": handed_off_to,
                },
                headers={"Authorization": "Bearer dev-internal"},
            )
            response.raise_for_status()
            return response.json()
