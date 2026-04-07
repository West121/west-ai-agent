from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class ProviderInfo:
    name: str
    models: tuple[str, ...]


class BaseProvider(ABC):
    info: ProviderInfo

    @property
    def name(self) -> str:
        return self.info.name

    @property
    def models(self) -> tuple[str, ...]:
        return self.info.models

    @abstractmethod
    def chat_completions(self, request: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError
