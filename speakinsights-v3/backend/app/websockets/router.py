"""
SpeakInsights v3 — WebSocket Router
"""

from fastapi import APIRouter

from app.websockets.lobby_ws import lobby_ws_endpoint
from app.websockets.transcript_ws import transcript_ws_endpoint
from app.websockets.meeting_ws import meeting_ws_endpoint

ws_router = APIRouter()


@ws_router.websocket("/ws/lobby/{meeting_id}")
async def ws_lobby(websocket, meeting_id: str):
    await lobby_ws_endpoint(websocket, meeting_id)


@ws_router.websocket("/ws/transcript/{meeting_id}")
async def ws_transcript(websocket, meeting_id: str):
    await transcript_ws_endpoint(websocket, meeting_id)


@ws_router.websocket("/ws/meeting/{meeting_id}")
async def ws_meeting(websocket, meeting_id: str):
    await meeting_ws_endpoint(websocket, meeting_id)
