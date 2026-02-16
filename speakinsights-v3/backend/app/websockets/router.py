"""
SpeakInsights v3 — Central WebSocket Router

Mounts all real-time WebSocket endpoints that main.py includes.
Three distinct channels per meeting:

  /ws/lobby/{meeting_id}       – Host ↔ participant lobby approval flow
  /ws/transcript/{meeting_id}  – Live transcript & caption streaming
  /ws/meeting/{meeting_id}     – Meeting lifecycle events & processing progress
"""

import logging

from fastapi import APIRouter, WebSocket

from app.websockets.lobby_ws import lobby_websocket
from app.websockets.transcript_ws import transcript_websocket
from app.websockets.meeting_ws import meeting_websocket

logger = logging.getLogger(__name__)

ws_router = APIRouter(tags=["WebSocket"])


# ── Lobby: host approves/declines participants waiting to join ───────────
@ws_router.websocket("/ws/lobby/{meeting_id}")
async def ws_lobby(websocket: WebSocket, meeting_id: str):
    """Lobby channel — handles join requests and host approval/decline."""
    logger.debug("WS lobby connection attempt for meeting %s", meeting_id)
    await lobby_websocket(websocket, meeting_id)


# ── Transcript: streams WhisperX segments + browser Speech API captions ──
@ws_router.websocket("/ws/transcript/{meeting_id}")
async def ws_transcript(websocket: WebSocket, meeting_id: str):
    """Transcript channel — relays live captions and accurate transcript segments."""
    logger.debug("WS transcript connection attempt for meeting %s", meeting_id)
    await transcript_websocket(websocket, meeting_id)


# ── Meeting events: participant join/leave, recording, processing ────────
@ws_router.websocket("/ws/meeting/{meeting_id}")
async def ws_meeting(websocket: WebSocket, meeting_id: str):
    """Meeting event channel — lifecycle events and post-processing progress."""
    logger.debug("WS meeting event connection attempt for meeting %s", meeting_id)
    await meeting_websocket(websocket, meeting_id)
