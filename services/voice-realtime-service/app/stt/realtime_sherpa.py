from __future__ import annotations

from app.stt.base import PartialTranscript


class SherpaRealtimeTranscriber:
    """Deterministic adapter placeholder for realtime sherpa-onnx integration."""

    def stream_partial(self, audio_chunk: bytes) -> PartialTranscript:
        text = audio_chunk.decode("utf-8").strip() if audio_chunk else ""
        if not text:
            return PartialTranscript(text="", is_final=False, confidence=0.0)
        return PartialTranscript(text=text, is_final=False, confidence=0.72)
