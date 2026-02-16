"""
SpeakInsights v3 — Meeting Events WebSocket
Handles participant join/leave events, meeting status changes,
recording state, processing progress, and screen-share events.

Clients connect to /ws/meeting/{meeting_id}
"""

import json
import logging
from typing import Dict, Optional, Set

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import text

from app.db.database import async_session_factory

logger = logging.getLogger(__name__)


class MeetingEventManager:
    """Manages WebSocket connections for general meeting events.

    Events broadcast:
    - participant_joined  {name, id, role}
    - participant_left    {name, id}
    - recording_started
    - recording_stopped
    - meeting_ending      {countdown_seconds: 10}
    - meeting_ended
    - processing_started
    - processing_progress {step, total_steps, current_step_name}
    - processing_completed {summary_id, task_count}
    - screen_share_started {participant_name}
    - screen_share_stopped
    """

    def __init__(self) -> None:
        # meeting_id -> set of WebSocket connections
        self._connections: Dict[str, Set[WebSocket]] = {}

    # ------------------------------------------------------------------
    # Connection management
    # ------------------------------------------------------------------

    async def connect(self, websocket: WebSocket, meeting_id: str) -> None:
        """Add a WebSocket to the meeting event pool."""
        await websocket.accept()
        if meeting_id not in self._connections:
            self._connections[meeting_id] = set()
        self._connections[meeting_id].add(websocket)
        logger.info(
            "Meeting WS connected for meeting %s (total: %d)",
            meeting_id,
            len(self._connections[meeting_id]),
        )

    async def disconnect(self, websocket: WebSocket, meeting_id: str) -> None:
        """Remove a WebSocket from the meeting event pool."""
        conns = self._connections.get(meeting_id)
        if conns:
            conns.discard(websocket)
            if not conns:
                del self._connections[meeting_id]
        logger.info("Meeting WS disconnected for meeting %s", meeting_id)

    # ------------------------------------------------------------------
    # Broadcasting
    # ------------------------------------------------------------------

    async def broadcast(
        self, meeting_id: str, event_type: str, data: Optional[dict] = None
    ) -> None:
        """Broadcast a meeting event to all connected clients."""
        message = json.dumps({"type": event_type, "data": data or {}})
        await self._send_all(meeting_id, message)

    async def notify_processing_progress(
        self, meeting_id: str, step: int, total: int, step_name: str
    ) -> None:
        """Convenience method called by the post-processing pipeline."""
        await self.broadcast(meeting_id, "processing_progress", {
            "step": step,
            "total_steps": total,
            "current_step_name": step_name,
        })

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _send_all(self, meeting_id: str, message: str) -> None:
        """Send a raw message string to every connected client in a meeting."""
        conns = self._connections.get(meeting_id, set()).copy()
        dead: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        # Prune dead connections
        if dead and meeting_id in self._connections:
            for ws in dead:
                self._connections[meeting_id].discard(ws)
            if not self._connections[meeting_id]:
                del self._connections[meeting_id]


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------
meeting_event_manager = MeetingEventManager()


# ---------------------------------------------------------------------------
# WebSocket endpoint function (mounted by router)
# ---------------------------------------------------------------------------

async def meeting_websocket(websocket: WebSocket, meeting_id: str):
    """WebSocket endpoint for meeting events."""

    # Validate meeting exists
    try:
        async with async_session_factory() as session:
            result = await session.execute(
                text("SELECT id FROM meetings WHERE id = :mid"),
                {"mid": meeting_id},
            )
            if not result.first():
                await websocket.close(code=4004, reason="Meeting not found")
                return
    except Exception as exc:
        logger.error("DB error validating meeting %s: %s", meeting_id, exc)
        await websocket.close(code=4500, reason="Internal error")
        return

    await meeting_event_manager.connect(websocket, meeting_id)

    try:
        while True:
            # Clients can send events (e.g. screen share start/stop)
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("Invalid JSON from meeting client: %s", raw[:200])
                continue

            msg_type = data.get("type")

            # Relay client-originated events to all participants
            if msg_type == "screen_share_started":
                await meeting_event_manager.broadcast(meeting_id, "screen_share_started", {
                    "participant_name": data.get("participant_name", "Unknown"),
                })
            elif msg_type == "screen_share_stopped":
                await meeting_event_manager.broadcast(meeting_id, "screen_share_stopped")
            elif msg_type == "participant_joined":
                await meeting_event_manager.broadcast(meeting_id, "participant_joined", data.get("data", {}))
            elif msg_type == "participant_left":
                await meeting_event_manager.broadcast(meeting_id, "participant_left", data.get("data", {}))
            else:
                logger.debug("Unhandled meeting client message type: %s", msg_type)

    except WebSocketDisconnect:
        await meeting_event_manager.disconnect(websocket, meeting_id)
    except Exception as exc:
        logger.error(
            "Meeting WS error for meeting %s: %s", meeting_id, exc, exc_info=True
        )
        await meeting_event_manager.disconnect(websocket, meeting_id)
