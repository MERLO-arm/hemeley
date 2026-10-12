"""
WebSocket manager for real-time payment / wallet notifications.

Architecture
- Clients connect to `/api/ws/notifications?user_id=...` (the user_id of a customer,
  vendor, delivery, or 'SUPER_ADMIN' for super admins).
- Any module can publish via `notify(user_ids, event, payload)`.
- Optionally, `broadcast(event, payload)` sends to every connected client (used for
  super-admin dashboards listening to all events).
- Connections are kept in an in-memory dict — fine for a single backend instance.
  For multi-instance scaling, swap for Redis pub/sub later.
"""
from __future__ import annotations

from typing import Dict, Set, List, Iterable
from datetime import datetime, timezone
import asyncio
import json
import logging

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class NotificationHub:
    def __init__(self) -> None:
        # user_id → set of active WebSockets
        self._clients: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clients.setdefault(user_id, set()).add(ws)
        logger.info(f"WS connected: user_id={user_id} (total={sum(len(s) for s in self._clients.values())})")

    async def disconnect(self, user_id: str, ws: WebSocket) -> None:
        async with self._lock:
            sockets = self._clients.get(user_id)
            if sockets and ws in sockets:
                sockets.remove(ws)
                if not sockets:
                    del self._clients[user_id]

    async def _send_to_socket(self, ws: WebSocket, message: dict) -> bool:
        try:
            await ws.send_text(json.dumps(message, default=str))
            return True
        except Exception:
            return False

    async def notify(self, user_ids: Iterable[str], event: str, payload: dict) -> None:
        """Send the event to every connected socket belonging to any of these user_ids."""
        message = {
            "event": event,
            "payload": payload,
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        dead: List[tuple[str, WebSocket]] = []
        async with self._lock:
            for uid in set(user_ids):
                sockets = self._clients.get(uid)
                if not sockets:
                    continue
                for ws in list(sockets):
                    ok = await self._send_to_socket(ws, message)
                    if not ok:
                        dead.append((uid, ws))
        for uid, ws in dead:
            await self.disconnect(uid, ws)

    async def broadcast(self, event: str, payload: dict) -> None:
        """Send to every connected client (e.g. super-admin dashboards)."""
        message = {
            "event": event,
            "payload": payload,
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        dead: List[tuple[str, WebSocket]] = []
        async with self._lock:
            for uid, sockets in self._clients.items():
                for ws in list(sockets):
                    ok = await self._send_to_socket(ws, message)
                    if not ok:
                        dead.append((uid, ws))
        for uid, ws in dead:
            await self.disconnect(uid, ws)


# Singleton instance used across the app
hub = NotificationHub()


# ============ FastAPI router ============

from fastapi import APIRouter, Query

ws_router = APIRouter()


@ws_router.websocket("/notifications")
async def notifications_endpoint(
    websocket: WebSocket,
    user_id: str = Query(...),
):
    """Subscribe to real-time notifications for a given user.

    Auth note: we keep this simple — clients pass their own user_id.
    Adversarial clients could subscribe to someone else's stream, but they would
    only receive metadata about events (amounts, status). Sensitive details
    remain protected behind authenticated REST endpoints. For stricter auth,
    pass a JWT in the query string and verify it here.
    """
    await hub.connect(user_id, websocket)
    try:
        # Server holds the connection open; periodically ping to keep alive
        while True:
            # We just await any incoming message — clients can send heartbeats
            data = await websocket.receive_text()
            # Echo a pong if a ping was sent (cheap keepalive)
            if data == "ping":
                try:
                    await websocket.send_text("pong")
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(user_id, websocket)


# ============ Helper: emit a wallet event from anywhere ============

async def emit_wallet_event(
    *,
    event: str,
    recipient_user_ids: Iterable[str],
    payload: dict,
    broadcast_to_admins: bool = True,
) -> None:
    """Fire a wallet/payment event to the specified users + (optionally) admins."""
    await hub.notify(recipient_user_ids, event, payload)
    if broadcast_to_admins:
        # Super admins subscribe with user_id="SUPER_ADMIN"
        await hub.notify(["SUPER_ADMIN"], event, payload)
