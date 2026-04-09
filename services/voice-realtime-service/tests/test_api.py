from fastapi.testclient import TestClient

from app.main import app
from app.api.router import get_voice_session_service
from app.events.message_bridge import RecordingBridge
from app.orchestrator.voice_orchestrator import VoiceTurnResult
from app.session.service import VoiceSessionService
from app.tts.base import SynthesizedAudio


class StubRecordingBridge(RecordingBridge):
    def __init__(self) -> None:
        self.transcripts: list[dict[str, object]] = []
        self.handoffs: list[dict[str, object]] = []

    async def create_voice_session(self, **kwargs: object) -> dict[str, object]:
        return {
            "id": 700,
            "livekit_room": kwargs.get("livekit_room"),
            "status": kwargs.get("status", "listening"),
        }

    async def append_transcript(self, **kwargs: object) -> dict[str, object]:
        self.transcripts.append(kwargs)
        return {"id": len(self.transcripts), **kwargs}

    async def create_handoff(self, **kwargs: object) -> dict[str, object]:
        self.handoffs.append(kwargs)
        return {"id": len(self.handoffs), **kwargs}


class StubOrchestrator:
    def partial_from_audio(self, audio_chunk: bytes) -> str:
        return audio_chunk.decode("utf-8")

    async def finalize_and_answer(self, *, conversation_id: int | str, transcript_text: str) -> VoiceTurnResult:
        return VoiceTurnResult(
            decision="answer",
            transcript=transcript_text,
            normalized_text=f"{transcript_text}。",
            answer="您好，已为您转成正式回复。",
            clarification=None,
            handoff=False,
            audio=SynthesizedAudio(content=b"audio", mime_type="audio/wav", duration_ms=500),
        )


def test_voice_api_session_start_partial_and_finalize() -> None:
    recording_bridge = StubRecordingBridge()
    service = VoiceSessionService(recording_bridge=recording_bridge, orchestrator=StubOrchestrator())  # type: ignore[arg-type]

    original_factory = app.dependency_overrides.get(get_voice_session_service)
    app.dependency_overrides[get_voice_session_service] = lambda: service
    try:
        client = TestClient(app)

        started = client.post("/sessions/start", json={"conversation_id": 11, "customer_profile_id": 22, "livekit_room": "room-voice"})
        assert started.status_code == 200
        assert started.json()["voice_session_id"] == 700

        partial = client.post("/sessions/700/partial", json={"transcript_text": "我想咨询退款", "speaker": "customer"})
        assert partial.status_code == 200
        assert partial.json()["text"] == "我想咨询退款"

        final = client.post("/sessions/700/finalize", json={"conversation_id": 11, "transcript_text": "我想咨询退款"})
        assert final.status_code == 200
        assert final.json()["decision"] == "answer"
        assert final.json()["audio_mime_type"] == "audio/wav"
        assert recording_bridge.transcripts[-1]["normalized_text"] == "我想咨询退款。"
    finally:
        if original_factory is None:
            app.dependency_overrides.pop(get_voice_session_service, None)
        else:
            app.dependency_overrides[get_voice_session_service] = original_factory
