from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import httpx

from app.core.config import get_settings
from app.events.message_bridge import MessageBridge
from app.nlu.entity_normalizer import EntityNormalizer
from app.stt.base import FinalizerProvider, RealtimeSttProvider
from app.stt.final_funasr import FunAsrFinalizer
from app.stt.realtime_sherpa import SherpaRealtimeTranscriber
from app.tts.base import SynthesizedAudio, TtsProvider
from app.tts.sherpa_tts import SherpaTtsProvider


@dataclass(frozen=True, slots=True)
class VoiceTurnResult:
    decision: str
    transcript: str
    normalized_text: str
    answer: str | None
    clarification: str | None
    handoff: bool
    audio: SynthesizedAudio | None


class AiDecisionClient(Protocol):
    async def answer(self, query: str) -> dict[str, object]: ...


class HttpAiDecisionClient:
    def __init__(self, *, base_url: str | None = None, timeout: float = 20.0) -> None:
        settings = get_settings()
        self.base_url = (base_url or settings.ai_service_base_url).rstrip("/")
        self.timeout = timeout

    async def answer(self, query: str) -> dict[str, object]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f"{self.base_url}/chat/answer", json={"query": query})
            response.raise_for_status()
            return response.json()


class VoiceOrchestrator:
    def __init__(
        self,
        *,
        stt: RealtimeSttProvider | None = None,
        finalizer: FinalizerProvider | None = None,
        normalizer: EntityNormalizer | None = None,
        tts: TtsProvider | None = None,
        ai_client: AiDecisionClient | None = None,
        message_bridge: MessageBridge | None = None,
    ) -> None:
        self.stt = stt or SherpaRealtimeTranscriber()
        self.finalizer = finalizer or FunAsrFinalizer()
        self.normalizer = normalizer or EntityNormalizer()
        self.tts = tts or SherpaTtsProvider()
        self.ai_client = ai_client or HttpAiDecisionClient()
        self.message_bridge = message_bridge or MessageBridge()

    def partial_from_audio(self, audio_chunk: bytes) -> str:
        return self.stt.stream_partial(audio_chunk).text

    async def finalize_and_answer(self, *, conversation_id: int | str, transcript_text: str) -> VoiceTurnResult:
        final = self.finalizer.finalize_segment(transcript_text)
        normalized = self.normalizer.normalize(final.normalized_text)
        decision = await self.ai_client.answer(normalized.text)
        action = str(decision.get("decision", "reject"))
        answer = decision.get("answer")
        clarification = decision.get("clarification")

        if action == "answer" and isinstance(answer, str) and answer.strip():
            spoken = answer.strip()
            audio = self.tts.speak(spoken)
            await self.message_bridge.append_assistant_message(conversation_id, spoken)
            return VoiceTurnResult(
                decision=action,
                transcript=final.text,
                normalized_text=normalized.text,
                answer=spoken,
                clarification=None,
                handoff=False,
                audio=audio,
            )

        if action == "clarify" and isinstance(clarification, str) and clarification.strip():
            spoken = clarification.strip()
            audio = self.tts.speak(spoken)
            await self.message_bridge.append_assistant_message(conversation_id, spoken)
            return VoiceTurnResult(
                decision=action,
                transcript=final.text,
                normalized_text=normalized.text,
                answer=None,
                clarification=spoken,
                handoff=False,
                audio=audio,
            )

        return VoiceTurnResult(
            decision=action,
            transcript=final.text,
            normalized_text=normalized.text,
            answer=None,
            clarification=clarification if isinstance(clarification, str) else None,
            handoff=action in {"handoff", "reject"},
            audio=None,
        )
