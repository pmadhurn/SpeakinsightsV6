"""
SpeakInsights v3 — WebSocket Router
Mounts all WebSocket endpoints.
"""

from fastapi import APIRouter, WebSocket

from app.websockets.lobby_ws import lobby_websocket
from app.websockets.transcript_ws import transcript_websocket
from app.websockets.meeting_ws import meeting_websocket

ws_router = APIRouter()


@ws_router.websocket("/ws/lobby/{meeting_id}")
async def ws_lobby(websocket: WebSocket, meeting_id: str):
    await lobby_websocket(websocket, meeting_id)


@ws_router.websocket("/ws/transcript/{meeting_id}")
async def ws_transcript(websocket: WebSocket, meeting_id: str):
    await transcript_websocket(websocket, meeting_id)


@ws_router.websocket("/ws/meeting/{meeting_id}")
async def ws_meeting(websocket: WebSocket, meeting_id: str):
    await meeting_websocket(websocket, meeting_id)
