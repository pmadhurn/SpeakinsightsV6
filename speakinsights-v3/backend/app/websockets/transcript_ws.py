"""
SpeakInsights v3 — Transcript WebSocket
Streams live transcript segments to connected clients.
"""

import json
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set


# Active transcript connections: meeting_id -> set of websockets
transcript_connections: Dict[str, Set[WebSocket]] = {}


async def transcript_ws_endpoint(websocket: WebSocket, meeting_id: str):
    """
    WebSocket endpoint for live transcript streaming.
    
    Server sends:
    - {"event": "segment", "data": {"speaker": "...", "text": "...", "start_time": ..., "end_time": ...}}
    - {"event": "update", "data": {"segment_id": "...", "text": "..."}}
    """
    await websocket.accept()

    if meeting_id not in transcript_connections:
        transcript_connections[meeting_id] = set()
    transcript_connections[meeting_id].add(websocket)

    try:
        while True:
            # Receive and broadcast transcript data
            data = await websocket.receive_text()
            message = json.loads(data)

            # Broadcast to all transcript listeners
            for conn in transcript_connections.get(meeting_id, set()):
                if conn != websocket:
                    try:
                        await conn.send_text(json.dumps(message))
                    except Exception:
                        pass

    except WebSocketDisconnect:
        transcript_connections.get(meeting_id, set()).discard(websocket)
        if not transcript_connections.get(meeting_id):
            transcript_connections.pop(meeting_id, None)
    except Exception:
        transcript_connections.get(meeting_id, set()).discard(websocket)


async def broadcast_transcript_segment(meeting_id: str, segment_data: dict):
    """Broadcast a new transcript segment to all connected clients."""
    message = json.dumps({"event": "segment", "data": segment_data})
    for conn in transcript_connections.get(meeting_id, set()).copy():
        try:
            await conn.send_text(message)
        except Exception:
            transcript_connections.get(meeting_id, set()).discard(conn)
