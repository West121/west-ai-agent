from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.state import presence_service

router = APIRouter(tags=["presence"])


@router.get("/presence/{conversation_id}")
def get_presence(conversation_id: str) -> dict[str, object]:
    clients = presence_service.list_clients(conversation_id)
    return {"conversation_id": conversation_id, "online_count": len(clients), "clients": clients}


@router.get("/unread/{conversation_id}/{client_id}")
def get_unread(conversation_id: str, client_id: str) -> dict[str, object]:
    from app.state import unread_counter_service

    return {"conversation_id": conversation_id, "client_id": client_id, "count": unread_counter_service.get(conversation_id, client_id)}


@router.post("/unread/{conversation_id}/{client_id}/reset")
def reset_unread(conversation_id: str, client_id: str) -> dict[str, object]:
    from app.state import unread_counter_service

    count = unread_counter_service.reset(conversation_id, client_id)
    return {"conversation_id": conversation_id, "client_id": client_id, "count": count}
