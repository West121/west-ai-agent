from __future__ import annotations


class UnreadCounterService:
    def __init__(self) -> None:
        self._counts: dict[tuple[str, str], int] = {}

    def increment(self, conversation_id: str, client_ids: list[str]) -> None:
        for client_id in client_ids:
            key = (conversation_id, client_id)
            self._counts[key] = self._counts.get(key, 0) + 1

    def get(self, conversation_id: str, client_id: str) -> int:
        return self._counts.get((conversation_id, client_id), 0)

    def reset(self, conversation_id: str, client_id: str) -> int:
        self._counts[(conversation_id, client_id)] = 0
        return 0
