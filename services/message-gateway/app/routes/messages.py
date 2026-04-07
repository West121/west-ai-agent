from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.message_store import MessageRecord
from app.state import delivery_service, message_ingest_service, message_store_service, presence_service, unread_counter_service

router = APIRouter(tags=["messages"])


class MessageAppendRequest(BaseModel):
    sender_id: str = Field(min_length=1)
    sender_role: str = Field(min_length=1)
    text: str = Field(min_length=1)


@router.get("/messages/{conversation_id}")
def get_messages(conversation_id: str) -> dict[str, object]:
    items = [message.as_dict() for message in message_store_service.list(conversation_id)]
    return {"conversation_id": conversation_id, "items": items}


@router.post("/messages/{conversation_id}")
async def append_message(conversation_id: str, payload: MessageAppendRequest) -> dict[str, object]:
    message = message_ingest_service.create_event(
        conversation_id=conversation_id,
        sender_id=payload.sender_id,
        role=payload.sender_role,
        text=payload.text,
    )
    stored_message = message_store_service.append(
        MessageRecord(
            id=message["id"],
            conversation_id=conversation_id,
            sender_id=payload.sender_id,
            sender_role=payload.sender_role,
            text=payload.text,
            status=message["status"],
        )
    )
    targets = presence_service.sockets(conversation_id)
    recipient_ids = [target.client_id for target in targets if target.client_id != payload.sender_id]
    unread_counter_service.increment(conversation_id, recipient_ids)
    event = {
        **message,
        "created_at": stored_message.created_at.isoformat(),
        "acked_by": stored_message.acked_by,
        "acked_at": stored_message.acked_at.isoformat() if stored_message.acked_at else None,
    }
    await delivery_service.broadcast(event, targets)
    return event
