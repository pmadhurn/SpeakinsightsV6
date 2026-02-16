"""
SpeakInsights v3 — Chat Schemas
"""

from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from typing import Optional


class ChatRequest(BaseModel):
    """Schema for sending a chat message."""
    message: str = Field(..., min_length=1)
    model: Optional[str] = None  # Ollama model to use
    session_id: Optional[str] = None  # Chat session for history
    meeting_ids: Optional[list[UUID]] = None  # Meetings to use for RAG context
    use_rag: bool = True  # Whether to use RAG


class ChatMessageResponse(BaseModel):
    """Schema for a single chat message."""
    id: UUID
    role: str
    content: str
    model_used: Optional[str] = None
    is_rag: bool = False
    created_at: datetime

    model_config = {"from_attributes": True, "protected_namespaces": ()}


class ChatResponse(BaseModel):
    """Schema for chat response."""
    message: ChatMessageResponse
    context_sources: Optional[list[dict]] = None  # RAG sources used


class ChatHistoryResponse(BaseModel):
    """Schema for chat history."""
    session_id: str
    messages: list[ChatMessageResponse]
    total: int
