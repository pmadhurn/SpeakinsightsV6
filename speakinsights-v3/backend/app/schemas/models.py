"""
SpeakInsights v3 — Ollama Model Schemas
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class OllamaModelInfo(BaseModel):
    """Schema for Ollama model information."""
    name: str
    size: Optional[int] = None  # bytes
    digest: Optional[str] = None
    modified_at: Optional[datetime] = None
    details: Optional[dict] = None


class OllamaModelListResponse(BaseModel):
    """Schema for list of Ollama models."""
    models: list[OllamaModelInfo]


class ModelPullRequest(BaseModel):
    """Schema for requesting a model pull."""
    name: str  # e.g., "llama3.2:3b"


class ModelPullProgress(BaseModel):
    """Schema for model pull progress update."""
    status: str
    digest: Optional[str] = None
    total: Optional[int] = None
    completed: Optional[int] = None
    percent: Optional[float] = None


class ModelDeleteRequest(BaseModel):
    """Schema for deleting a model."""
    name: str
