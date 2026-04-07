from __future__ import annotations

from uuid import uuid4


class MessageIngestService:
    def create_event(self, conversation_id: str, sender_id: str, role: str, text: str) -> dict[str, str]:
        return {
            "id": str(uuid4()),
            "type": "message.new",
            "conversation_id": conversation_id,
            "sender_id": sender_id,
            "sender_role": role,
            "text": text,
            "status": "sent",
        }
