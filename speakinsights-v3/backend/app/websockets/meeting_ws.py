"""
SpeakInsights v3 — Meeting Events WebSocket
Handles participant join/leave events, meeting status changes, etc.
"""

import json
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set


# Active meeting connections: meeting_id -> set of websockets
meeting_connections: Dict[str, Set[WebSocket]] = {}


async def meeting_ws_endpoint(websocket: WebSocket, meeting_id: str):
    """
    WebSocket endpoint for meeting events.
    
    Events:
    - {"event": "participant_joined", "data": {"participant_id": "...", "display_name": "..."}}
    - {"event": "participant_left", "data": {"participant_id": "..."}}
    - {"event": "meeting_started"}
    - {"event": "meeting_ended"}
    - {"event": "recording_started"}
    """
    await websocket.accept()

    if meeting_id not in meeting_connections:
        meeting_connections[meeting_id] = set()
    meeting_connections[meeting_id].add(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            # Broadcast to all meeting connections
            for conn in meeting_connections.get(meeting_id, set()):
                if conn != websocket:
                    try:
                        await conn.send_text(json.dumps(message))
                    except Exception:
                        pass

    except WebSocketDisconnect:
        meeting_connections.get(meeting_id, set()).discard(websocket)
        if not meeting_connections.get(meeting_id):
            meeting_connections.pop(meeting_id, None)
    except Exception:
        meeting_connections.get(meeting_id, set()).discard(websocket)


async def broadcast_meeting_event(meeting_id: str, event: str, data: dict = None):
    """Broadcast a meeting event to all connected clients."""
    message = json.dumps({"event": event, "data": data or {}})
    for conn in meeting_connections.get(meeting_id, set()).copy():
        try:
            await conn.send_text(message)
        except Exception:
            meeting_connections.get(meeting_id, set()).discard(conn)
