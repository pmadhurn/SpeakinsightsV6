"""
SpeakInsights v3 — Lobby WebSocket
Handles participant join requests and host approval/decline.

HOST connects to   /ws/lobby/{meeting_id}?role=host
PARTICIPANT connects to /ws/lobby/{meeting_id}?role=participant&participant_id={id}
"""

import json
import logging
from datetime import datetime, timezone
from typing import Dict, Optional

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import select, text

from app.config import settings
from app.core.livekit_service import LiveKitService
from app.db.database import async_session_factory

logger = logging.getLogger(__name__)


class LobbyManager:
    """Manages WebSocket connections for the meeting lobby (waiting room).

    Two types of connections tracked per meeting:
    - host_connections[meeting_id] -> WebSocket
    - participant_connections[meeting_id][participant_id] -> WebSocket
    - waiting_list[meeting_id] -> [{id, name, timestamp}, ...]
    """

    def __init__(self) -> None:
        # meeting_id -> WebSocket (only one host per meeting)
        self.host_connections: Dict[str, WebSocket] = {}
        # meeting_id -> {participant_id: WebSocket}
        self.participant_connections: Dict[str, Dict[str, WebSocket]] = {}
        # meeting_id -> [{id, name, timestamp}]
        self.waiting_list: Dict[str, list] = {}
        self._livekit = LiveKitService()

    # ------------------------------------------------------------------
    # Connection management
    # ------------------------------------------------------------------

    async def connect_host(self, websocket: WebSocket, meeting_id: str) -> None:
        """Register the host connection for a meeting."""
        await websocket.accept()
        self.host_connections[meeting_id] = websocket
        logger.info("Host connected to lobby for meeting %s", meeting_id)

        # Send current waiting list to the newly connected host
        waiting = self.get_waiting_list(meeting_id)
        if waiting:
            await self._send(websocket, {
                "type": "waiting_list",
                "participants": waiting,
            })

    async def connect_participant(
        self, websocket: WebSocket, meeting_id: str, participant_id: str
    ) -> None:
        """Register a waiting participant and notify the host."""
        await websocket.accept()

        if meeting_id not in self.participant_connections:
            self.participant_connections[meeting_id] = {}
        self.participant_connections[meeting_id][participant_id] = websocket

        # Fetch participant display name from DB
        display_name = participant_id  # fallback
        try:
            async with async_session_factory() as session:
                result = await session.execute(
                    text("SELECT display_name FROM participants WHERE id = :pid"),
                    {"pid": participant_id},
                )
                row = result.first()
                if row:
                    display_name = row[0]
        except Exception as exc:
            logger.warning("Could not fetch participant name: %s", exc)

        # Add to waiting list
        if meeting_id not in self.waiting_list:
            self.waiting_list[meeting_id] = []
        entry = {
            "id": participant_id,
            "name": display_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self.waiting_list[meeting_id].append(entry)
        position = len(self.waiting_list[meeting_id])

        logger.info(
            "Participant %s (%s) waiting in lobby for meeting %s (position %d)",
            participant_id, display_name, meeting_id, position,
        )

        # Tell the participant their position
        await self._send(websocket, {"type": "waiting", "position": position})

        # Notify the host about the new join request
        await self.notify_host(meeting_id, {
            "type": "join_request",
            "participant": entry,
        })

    async def disconnect(self, websocket: WebSocket, meeting_id: str) -> None:
        """Clean up a disconnected WebSocket (host or participant)."""
        # Check host
        if self.host_connections.get(meeting_id) is websocket:
            del self.host_connections[meeting_id]
            logger.info("Host disconnected from lobby for meeting %s", meeting_id)
            return

        # Check participants
        pconns = self.participant_connections.get(meeting_id, {})
        pid_to_remove: Optional[str] = None
        for pid, ws in pconns.items():
            if ws is websocket:
                pid_to_remove = pid
                break
        if pid_to_remove:
            del pconns[pid_to_remove]
            # Remove from waiting list
            if meeting_id in self.waiting_list:
                self.waiting_list[meeting_id] = [
                    w for w in self.waiting_list[meeting_id] if w["id"] != pid_to_remove
                ]
            logger.info(
                "Participant %s disconnected from lobby for meeting %s",
                pid_to_remove, meeting_id,
            )

        # Cleanup empty dicts
        if meeting_id in self.participant_connections and not self.participant_connections[meeting_id]:
            del self.participant_connections[meeting_id]
        if meeting_id in self.waiting_list and not self.waiting_list[meeting_id]:
            del self.waiting_list[meeting_id]

    # ------------------------------------------------------------------
    # Host message handling
    # ------------------------------------------------------------------

    async def handle_host_message(self, data: dict, meeting_id: str) -> None:
        """Process approve / decline messages from the host."""
        msg_type = data.get("type")
        participant_id = data.get("participant_id")

        if not participant_id:
            logger.warning("Host message missing participant_id")
            return

        if msg_type == "approve":
            await self._approve_participant(meeting_id, participant_id)
        elif msg_type == "decline":
            await self._decline_participant(meeting_id, participant_id)
        else:
            logger.warning("Unknown host lobby message type: %s", msg_type)

    async def _approve_participant(self, meeting_id: str, participant_id: str) -> None:
        """Approve a participant: generate LiveKit token, update DB, notify."""
        logger.info("Approving participant %s for meeting %s", participant_id, meeting_id)

        try:
            # Fetch meeting and participant from DB
            async with async_session_factory() as session:
                # Fetch meeting room name
                m_result = await session.execute(
                    text("SELECT id, room_id FROM meetings WHERE id = :mid"),
                    {"mid": meeting_id},
                )
                m_row = m_result.first()
                if not m_row:
                    logger.error("Meeting %s not found during approval", meeting_id)
                    return

                # Fetch participant
                p_result = await session.execute(
                    text("SELECT id, display_name FROM participants WHERE id = :pid"),
                    {"pid": participant_id},
                )
                p_row = p_result.first()
                if not p_row:
                    logger.error("Participant %s not found during approval", participant_id)
                    return

                room_name = m_row[1] or str(m_row[0])
                p_display_name = p_row[1]

                # Generate LiveKit token
                token = await self._livekit.generate_token(
                    room_name=room_name,
                    participant_name=p_display_name,
                    is_host=False,
                )

                # Update participant record
                await session.execute(
                    text("UPDATE participants SET status = 'approved', joined_at = :now WHERE id = :pid"),
                    {"pid": participant_id, "now": datetime.now(timezone.utc)},
                )
                await session.commit()

            # Remove from waiting list
            if meeting_id in self.waiting_list:
                self.waiting_list[meeting_id] = [
                    w for w in self.waiting_list[meeting_id] if w["id"] != participant_id
                ]

            # Notify the participant
            await self.notify_participant(meeting_id, participant_id, {
                "type": "approved",
                "token": token,
                "room_id": room_name,
                "livekit_url": settings.LIVEKIT_URL,
            })

            logger.info("Participant %s approved for meeting %s", participant_id, meeting_id)

        except Exception as exc:
            logger.error("Error approving participant %s: %s", participant_id, exc, exc_info=True)
            await self.notify_participant(meeting_id, participant_id, {
                "type": "error",
                "message": "Failed to process approval. Please try again.",
            })

    async def _decline_participant(self, meeting_id: str, participant_id: str) -> None:
        """Decline a participant and notify them."""
        logger.info("Declining participant %s for meeting %s", participant_id, meeting_id)

        # Remove from waiting list
        if meeting_id in self.waiting_list:
            self.waiting_list[meeting_id] = [
                w for w in self.waiting_list[meeting_id] if w["id"] != participant_id
            ]

        await self.notify_participant(meeting_id, participant_id, {
            "type": "declined",
            "reason": "The host declined your request to join.",
        })

    # ------------------------------------------------------------------
    # Notifications
    # ------------------------------------------------------------------

    async def notify_host(self, meeting_id: str, message: dict) -> None:
        """Send a message to the host of a meeting."""
        ws = self.host_connections.get(meeting_id)
        if ws:
            await self._send(ws, message)

    async def notify_participant(
        self, meeting_id: str, participant_id: str, message: dict
    ) -> None:
        """Send a message to a specific waiting participant."""
        ws = self.participant_connections.get(meeting_id, {}).get(participant_id)
        if ws:
            await self._send(ws, message)

    def get_waiting_list(self, meeting_id: str) -> list:
        """Return the current waiting list for a meeting."""
        return list(self.waiting_list.get(meeting_id, []))

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    async def _send(ws: WebSocket, data: dict) -> None:
        """Send JSON to a WebSocket, silently handling broken connections."""
        try:
            await ws.send_text(json.dumps(data))
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------
lobby_manager = LobbyManager()


# ---------------------------------------------------------------------------
# WebSocket endpoint function (mounted by router)
# ---------------------------------------------------------------------------

async def lobby_websocket(websocket: WebSocket, meeting_id: str):
    """
    WebSocket endpoint for lobby management.

    Query params:
    - role: "host" or "participant"
    - participant_id: required when role=participant
    """
    role = websocket.query_params.get("role", "participant")
    participant_id = websocket.query_params.get("participant_id", "")

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

    # Register connection
    if role == "host":
        await lobby_manager.connect_host(websocket, meeting_id)
    else:
        if not participant_id:
            await websocket.accept()
            await websocket.close(code=4400, reason="participant_id required")
            return
        await lobby_manager.connect_participant(websocket, meeting_id, participant_id)

    # Message loop
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("Invalid JSON from lobby client: %s", raw[:200])
                continue

            if role == "host":
                await lobby_manager.handle_host_message(data, meeting_id)
            # Participants don't send actionable messages in lobby
    except WebSocketDisconnect:
        await lobby_manager.disconnect(websocket, meeting_id)
    except Exception as exc:
        logger.error("Lobby WS error for meeting %s: %s", meeting_id, exc, exc_info=True)
        await lobby_manager.disconnect(websocket, meeting_id)
