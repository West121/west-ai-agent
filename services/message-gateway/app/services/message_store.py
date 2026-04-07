from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Protocol


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class MessageRecord:
    id: str
    conversation_id: str
    sender_id: str
    sender_role: str
    text: str
    status: str = "sent"
    created_at: datetime = field(default_factory=utcnow)
    acked_by: str | None = None
    acked_at: datetime | None = None

    def as_dict(self) -> dict[str, object]:
        payload = asdict(self)
        payload["created_at"] = self.created_at.isoformat()
        payload["acked_at"] = self.acked_at.isoformat() if self.acked_at is not None else None
        return payload


class MessageStore(Protocol):
    def append(self, message: MessageRecord) -> MessageRecord: ...

    def get(self, conversation_id: str, message_id: str) -> MessageRecord | None: ...

    def ack(self, conversation_id: str, message_id: str, acked_by: str) -> MessageRecord: ...

    def list(self, conversation_id: str) -> list[MessageRecord]: ...


class InMemoryMessageStore:
    def __init__(self) -> None:
        self._messages: dict[str, list[MessageRecord]] = {}

    def append(self, message: MessageRecord) -> MessageRecord:
        self._messages.setdefault(message.conversation_id, []).append(message)
        return message

    def get(self, conversation_id: str, message_id: str) -> MessageRecord | None:
        for message in self._messages.get(conversation_id, []):
            if message.id == message_id:
                return message
        return None

    def ack(self, conversation_id: str, message_id: str, acked_by: str) -> MessageRecord:
        message = self.get(conversation_id, message_id)
        if message is None:
            raise KeyError(message_id)
        message.status = "read"
        message.acked_by = acked_by
        message.acked_at = utcnow()
        return message

    def list(self, conversation_id: str) -> list[MessageRecord]:
        return list(self._messages.get(conversation_id, []))
