from __future__ import annotations

from dataclasses import dataclass

from app.nlu.dictionaries import IPHONE_ALIASES, SERVICE_ALIASES, STORE_ALIASES


@dataclass(frozen=True, slots=True)
class NormalizationResult:
    text: str
    replacements: dict[str, str]


class EntityNormalizer:
    def normalize(self, text: str) -> NormalizationResult:
        normalized = text
        replacements: dict[str, str] = {}
        for source, target in {**IPHONE_ALIASES, **STORE_ALIASES, **SERVICE_ALIASES}.items():
            if source in normalized:
                normalized = normalized.replace(source, target)
                replacements[source] = target
        return NormalizationResult(text=normalized, replacements=replacements)
