from __future__ import annotations

from app.stt.base import FinalTranscript


class FunAsrFinalizer:
    """Deterministic adapter placeholder for final-pass FunASR integration."""

    def finalize_segment(self, text: str) -> FinalTranscript:
        cleaned = " ".join(text.strip().split())
        if not cleaned:
            return FinalTranscript(text="", normalized_text="", confidence=0.0)
        normalized = cleaned
        if normalized[-1] not in {"。", "！", "？", ".", "!", "?"}:
            normalized = f"{normalized}。"
        return FinalTranscript(text=cleaned, normalized_text=normalized, confidence=0.9)
