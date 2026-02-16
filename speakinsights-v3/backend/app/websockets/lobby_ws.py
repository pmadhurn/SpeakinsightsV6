"""
SpeakInsights v3 — Lobby WebSocket
Handles participant join requests and host approval/decline.
"""

import json
import uuid
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set


# Active lobby connections: meeting_id -> set of websockets
lobby_connections: Dict[str, Set[WebSocket]] = {}


async def lobby_ws_endpoint(websocket: WebSocket, meeting_id: str):
    """
    WebSocket endpoint for lobby management.
    
    Messages from host:
    - {"action": "approve", "participant_id": "..."}
    - {"action": "decline", "participant_id": "..."}
    
    Messages to participants:
    - {"event": "approved", "participant_id": "...", "token": "..."}
    - {"event": "declined", "participant_id": "..."}
    - {"event": "join_request", "participant_id": "...", "display_name": "..."}
    """
    await websocket.accept()

    if meeting_id not in lobby_connections:
        lobby_connections[meeting_id] = set()
    lobby_connections[meeting_id].add(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            # Broadcast to all lobby connections for this meeting
            for conn in lobby_connections.get(meeting_id, set()):
                if conn != websocket:
                    try:
                        await conn.send_text(json.dumps(message))
                    except Exception:
                        pass

    except WebSocketDisconnect:
        lobby_connections.get(meeting_id, set()).discard(websocket)
        if not lobby_connections.get(meeting_id):
            lobby_connections.pop(meeting_id, None)
    except Exception:
        lobby_connections.get(meeting_id, set()).discard(websocket)
