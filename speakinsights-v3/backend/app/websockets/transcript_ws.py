"""
SpeakInsights v3 — Transcript WebSocket
Streams live transcript segments and live captions to connected clients.

Clients connect to /ws/transcript/{meeting_id}
"""

import json
import logging
from typing import Dict, Set

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import text

from app.db.database import async_session_factory

logger = logging.getLogger(__name__)


class TranscriptStreamManager:
    """Manages WebSocket connections for live transcript streaming.

    Messages sent to clients:
    - {type: 'segment', data: {speaker, text, start, end, sentiment_score, sentiment_label, words, language}}
    - {type: 'caption', speaker: '...', text: '...'}

    Messages received from clients:
    - {type: 'caption', text: '...', speaker: '...'} -> browser Speech API result, relay to all
    """

    def __init__(self) -> None:
        # meeting_id -> set of WebSocket connections
        self._connections: Dict[str, Set[WebSocket]] = {}

    # ------------------------------------------------------------------
    # Connection management
    # ------------------------------------------------------------------

    async def connect(self, websocket: WebSocket, meeting_id: str) -> None:
        """Add a WebSocket to the connection pool for a meeting."""
        await websocket.accept()
        if meeting_id not in self._connections:
            self._connections[meeting_id] = set()
        self._connections[meeting_id].add(websocket)
        logger.info(
            "Transcript WS connected for meeting %s (total: %d)",
            meeting_id,
            len(self._connections[meeting_id]),
        )

    async def disconnect(self, websocket: WebSocket, meeting_id: str) -> None:
        """Remove a WebSocket from the connection pool."""
        conns = self._connections.get(meeting_id)
        if conns:
            conns.discard(websocket)
            if not conns:
                del self._connections[meeting_id]
        logger.info("Transcript WS disconnected for meeting %s", meeting_id)

    def get_connection_count(self, meeting_id: str) -> int:
        """Return the number of connected clients for a meeting."""
        return len(self._connections.get(meeting_id, set()))

    # ------------------------------------------------------------------
    # Broadcasting
    # ------------------------------------------------------------------

    async def broadcast_segment(self, meeting_id: str, segment_data: dict) -> None:
        """Broadcast a new WhisperX-processed transcript segment to all clients.

        segment_data should contain: speaker, text, start, end,
        sentiment_score, sentiment_label, words, language
        """
        message = json.dumps({"type": "segment", "data": segment_data})
        await self._broadcast(meeting_id, message)

    async def broadcast_caption(self, meeting_id: str, caption_data: dict) -> None:
        """Broadcast a live caption (from browser Speech API) to all clients.

        caption_data should contain: speaker, text
        """
        message = json.dumps({
            "type": "caption",
            "speaker": caption_data.get("speaker", "Unknown"),
            "text": caption_data.get("text", ""),
        })
        await self._broadcast(meeting_id, message)

    async def _broadcast(self, meeting_id: str, message: str) -> None:
        """Send a raw message string to every client in a meeting."""
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

    # ------------------------------------------------------------------
    # Client message handling
    # ------------------------------------------------------------------

    async def handle_client_message(
        self, data: dict, meeting_id: str, sender: WebSocket
    ) -> None:
        """Process messages received from a client.

        Currently supports:
        - {type: 'caption', text: '...', speaker: '...'} -> relay to all
        """
        msg_type = data.get("type")
        if msg_type == "caption":
            await self.broadcast_caption(meeting_id, {
                "speaker": data.get("speaker", "Unknown"),
                "text": data.get("text", ""),
            })
        else:
            logger.debug("Unknown transcript client message type: %s", msg_type)


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------
transcript_manager = TranscriptStreamManager()


# ---------------------------------------------------------------------------
# WebSocket endpoint function (mounted by router)
# ---------------------------------------------------------------------------

async def transcript_websocket(websocket: WebSocket, meeting_id: str):
    """WebSocket endpoint for live transcript streaming."""

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

    await transcript_manager.connect(websocket, meeting_id)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("Invalid JSON from transcript client: %s", raw[:200])
                continue
            await transcript_manager.handle_client_message(data, meeting_id, websocket)
    except WebSocketDisconnect:
        await transcript_manager.disconnect(websocket, meeting_id)
    except Exception as exc:
        logger.error(
            "Transcript WS error for meeting %s: %s", meeting_id, exc, exc_info=True
        )
        await transcript_manager.disconnect(websocket, meeting_id)
