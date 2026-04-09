from __future__ import annotations

from app.tts.base import SynthesizedAudio


class SherpaTtsProvider:
    """Deterministic local TTS placeholder."""

    def speak(self, text: str) -> SynthesizedAudio:
        payload = text.strip().encode("utf-8")
        duration_ms = max(400, len(payload) * 60)
        return SynthesizedAudio(content=payload, mime_type="audio/wav", duration_ms=duration_ms)
