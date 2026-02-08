"""Pydantic models for chat API requests and responses."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Request body for sending a chat message."""

    agent_name: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)
    previous_response_id: str | None = None


class ChatResponse(BaseModel):
    """Response from the chat proxy."""

    text: str
    response_id: str
    tool_calls: list[str] = []
