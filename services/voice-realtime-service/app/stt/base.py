from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class PartialTranscript:
    text: str
    is_final: bool
    confidence: float


@dataclass(frozen=True, slots=True)
class FinalTranscript:
    text: str
    normalized_text: str
    confidence: float


class RealtimeSttProvider(Protocol):
    def stream_partial(self, audio_chunk: bytes) -> PartialTranscript: ...


class FinalizerProvider(Protocol):
    def finalize_segment(self, text: str) -> FinalTranscript: ...
