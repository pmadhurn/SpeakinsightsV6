"""
SpeakInsights v3 — Models Package
Import all models so SQLAlchemy registers them.
"""

from app.models.meeting import Meeting
from app.models.participant import Participant
from app.models.transcription import TranscriptionSegment
from app.models.recording import Recording, IndividualRecording
from app.models.summary import Summary
from app.models.task import Task
from app.models.embedding import TranscriptEmbedding
from app.models.chat import ChatMessage
from app.models.calendar_export import CalendarExport

__all__ = [
    "Meeting",
    "Participant",
    "TranscriptionSegment",
    "Recording",
    "IndividualRecording",
    "Summary",
    "Task",
    "TranscriptEmbedding",
    "ChatMessage",
    "CalendarExport",
]
