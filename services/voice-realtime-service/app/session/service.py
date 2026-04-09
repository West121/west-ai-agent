from __future__ import annotations

from dataclasses import dataclass

from app.events.message_bridge import RecordingBridge
from app.orchestrator.voice_orchestrator import VoiceOrchestrator, VoiceTurnResult


@dataclass(frozen=True, slots=True)
class VoiceSessionBootstrap:
    voice_session_id: int
    livekit_room: str | None
    status: str


class VoiceSessionService:
    def __init__(
        self,
        *,
        recording_bridge: RecordingBridge | None = None,
        orchestrator: VoiceOrchestrator | None = None,
    ) -> None:
        self.recording_bridge = recording_bridge or RecordingBridge()
        self.orchestrator = orchestrator or VoiceOrchestrator()

    async def start_session(
        self,
        *,
        conversation_id: int,
        customer_profile_id: int,
        livekit_room: str | None = None,
    ) -> VoiceSessionBootstrap:
        created = await self.recording_bridge.create_voice_session(
            conversation_id=conversation_id,
            customer_profile_id=customer_profile_id,
            status="listening",
            livekit_room=livekit_room,
        )
        return VoiceSessionBootstrap(
            voice_session_id=int(created["id"]),
            livekit_room=created.get("livekit_room"),
            status=str(created["status"]),
        )

    async def append_partial(
        self,
        *,
        voice_session_id: int,
        transcript_text: str,
        speaker: str = "customer",
    ) -> dict[str, object]:
        partial = self.orchestrator.partial_from_audio(transcript_text.encode("utf-8"))
        return await self.recording_bridge.append_transcript(
            voice_session_id=voice_session_id,
            speaker=speaker,
            text=partial,
            normalized_text=None,
            is_final=False,
        )

    async def finalize_turn(
        self,
        *,
        voice_session_id: int,
        conversation_id: int,
        transcript_text: str,
    ) -> VoiceTurnResult:
        result = await self.orchestrator.finalize_and_answer(
            conversation_id=conversation_id,
            transcript_text=transcript_text,
        )
        await self.recording_bridge.append_transcript(
            voice_session_id=voice_session_id,
            speaker="customer",
            text=result.transcript,
            normalized_text=result.normalized_text,
            is_final=True,
        )
        if result.handoff:
            await self.recording_bridge.create_handoff(
                voice_session_id=voice_session_id,
                reason="ai_handoff",
                summary=result.clarification or result.transcript,
            )
        return result
