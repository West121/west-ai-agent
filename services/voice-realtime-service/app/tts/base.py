from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class SynthesizedAudio:
    content: bytes
    mime_type: str
    duration_ms: int


class TtsProvider(Protocol):
    def speak(self, text: str) -> SynthesizedAudio: ...
