from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.message_store import MessageRecord
from app.state import (
    delivery_service,
    message_ingest_service,
    message_store_service,
    presence_service,
    unread_counter_service,
)

router = APIRouter()


@router.websocket("/ws/{conversation_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    conversation_id: str,
) -> None:
    client_id = websocket.query_params.get("client_id", "")
    role = websocket.query_params.get("role", "unknown")

    if not client_id:
        await websocket.close(code=1008, reason="client_id is required")
        return

    await presence_service.connect(conversation_id=conversation_id, client_id=client_id, role=role, websocket=websocket)
    await websocket.send_json(
        {
            "type": "connection.ack",
            "conversation_id": conversation_id,
            "client_id": client_id,
            "role": role,
        }
    )

    try:
        while True:
            payload = await websocket.receive_json()
            event_type = payload.get("type")

            if event_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            if event_type != "message.send":
                if event_type == "message.ack":
                    message_id = str(payload.get("message_id", "")).strip()
                    if not message_id:
                        await websocket.send_json({"type": "error", "detail": "message_id is required"})
                        continue

                    try:
                        message = message_store_service.ack(conversation_id, message_id, client_id)
                    except KeyError:
                        await websocket.send_json({"type": "error", "detail": "message not found"})
                        continue

                    unread_counter_service.reset(conversation_id, client_id)
                    ack_payload = {
                        "type": "message.ack",
                        "conversation_id": conversation_id,
                        "message_id": message.id,
                        "status": message.status,
                        "acked_by": client_id,
                        "acked_at": message.acked_at.isoformat() if message.acked_at else None,
                    }
                    targets = presence_service.sockets(conversation_id)
                    await delivery_service.broadcast_except(ack_payload, targets, client_id)
                    continue

                await websocket.send_json({"type": "error", "detail": "unsupported event"})
                continue

            message = message_ingest_service.create_event(
                conversation_id=conversation_id,
                sender_id=client_id,
                role=role,
                text=str(payload.get("text", "")),
            )
            stored_message = message_store_service.append(
                MessageRecord(
                    id=message["id"],
                    conversation_id=conversation_id,
                    sender_id=client_id,
                    sender_role=role,
                    text=message["text"],
                    status=message["status"],
                )
            )
            targets = presence_service.sockets(conversation_id)
            recipient_ids = [target.client_id for target in targets if target.client_id != client_id]
            unread_counter_service.increment(conversation_id, recipient_ids)
            await delivery_service.broadcast(
                {
                    **message,
                    "created_at": stored_message.created_at.isoformat(),
                    "acked_by": stored_message.acked_by,
                    "acked_at": stored_message.acked_at.isoformat() if stored_message.acked_at else None,
                },
                targets,
            )
    except WebSocketDisconnect:
        presence_service.disconnect(conversation_id, client_id)
