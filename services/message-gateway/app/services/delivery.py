from __future__ import annotations

from app.services.presence import PresenceClient


class DeliveryService:
    async def broadcast(self, payload: dict[str, str], targets: list[PresenceClient]) -> None:
        for target in targets:
            await target.websocket.send_json(payload)

    async def broadcast_except(
        self,
        payload: dict[str, str],
        targets: list[PresenceClient],
        excluded_client_id: str,
    ) -> None:
        for target in targets:
            if target.client_id == excluded_client_id:
                continue
            await target.websocket.send_json(payload)
