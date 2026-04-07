from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import WebSocket


@dataclass
class PresenceClient:
    client_id: str
    role: str
    websocket: WebSocket

    def as_dict(self) -> dict[str, str]:
        return {"client_id": self.client_id, "role": self.role}


class PresenceService:
    def __init__(self) -> None:
        self._rooms: dict[str, dict[str, PresenceClient]] = {}

    async def connect(self, conversation_id: str, client_id: str, role: str, websocket: WebSocket) -> PresenceClient:
        await websocket.accept()
        room = self._rooms.setdefault(conversation_id, {})
        client = PresenceClient(client_id=client_id, role=role, websocket=websocket)
        room[client_id] = client
        return client

    def disconnect(self, conversation_id: str, client_id: str) -> None:
        room = self._rooms.get(conversation_id)
        if room is None:
            return
        room.pop(client_id, None)
        if not room:
            self._rooms.pop(conversation_id, None)

    def list_clients(self, conversation_id: str) -> list[dict[str, str]]:
        room = self._rooms.get(conversation_id, {})
        return [client.as_dict() for client in room.values()]

    def sockets(self, conversation_id: str) -> list[PresenceClient]:
        room = self._rooms.get(conversation_id, {})
        return list(room.values())
