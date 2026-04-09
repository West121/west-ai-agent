import asyncio

from app.events.message_bridge import MessageBridge
from app.orchestrator.voice_orchestrator import VoiceOrchestrator
from app.tts.base import SynthesizedAudio


class StubAiClient:
    def __init__(self, payload: dict[str, object]) -> None:
        self.payload = payload
        self.queries: list[str] = []

    async def answer(self, query: str) -> dict[str, object]:
        self.queries.append(query)
        return self.payload


class StubBridge(MessageBridge):
    def __init__(self) -> None:
        self.messages: list[tuple[int | str, str]] = []

    async def append_assistant_message(self, conversation_id: int | str, text: str) -> dict[str, object]:
        self.messages.append((conversation_id, text))
        return {"conversation_id": conversation_id, "text": text}


class StubTts:
    def speak(self, text: str) -> SynthesizedAudio:
        return SynthesizedAudio(content=text.encode("utf-8"), mime_type="audio/wav", duration_ms=888)


def test_voice_orchestrator_answers_and_publishes_message() -> None:
    ai_client = StubAiClient({"decision": "answer", "answer": "一般 1 到 3 个工作日到账。"})
    bridge = StubBridge()
    orchestrator = VoiceOrchestrator(ai_client=ai_client, message_bridge=bridge, tts=StubTts())
    result = asyncio.run(orchestrator.finalize_and_answer(conversation_id=12, transcript_text="我想咨询退款"))
    assert result.decision == "answer"
    assert result.answer == "一般 1 到 3 个工作日到账。"
    assert result.audio is not None
    assert bridge.messages == [(12, "一般 1 到 3 个工作日到账。")]
    assert ai_client.queries == ["我想咨询退款。"]


def test_voice_orchestrator_returns_handoff_without_audio() -> None:
    ai_client = StubAiClient({"decision": "handoff", "clarification": "请转人工处理"})
    bridge = StubBridge()
    orchestrator = VoiceOrchestrator(ai_client=ai_client, message_bridge=bridge, tts=StubTts())
    result = asyncio.run(orchestrator.finalize_and_answer(conversation_id=99, transcript_text="我想转人工"))
    assert result.handoff is True
    assert result.audio is None
    assert bridge.messages == []
