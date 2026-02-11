"""Pydantic models for agent API requests and responses."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ToolSelection(BaseModel):
    """A tool chosen by the user with configured parameter values."""

    tool_id: str
    deploy_params: dict[str, Any] = {}
    runtime_params: dict[str, Any] = {}


class PromptParam(BaseModel):
    """A template parameter for agent instructions."""

    key: str
    label: str = ""
    type: str = "string"
    options: list[str] = []
    default: str = ""
    required: bool = False
    description: str = ""
    placeholder: str = ""


class AgentCreate(BaseModel):
    """Request body for deploying an agent."""

    name: str = Field(..., min_length=1, max_length=100)
    model: str = "gpt-4.1"
    instructions: str = Field(..., min_length=1)
    tools: list[ToolSelection] = []
    prompt_params: list[PromptParam] = []


class AgentResponse(BaseModel):
    """Response for a deployed agent."""

    name: str
    id: str
    version: int
    description: str | None = None
    prompt_params: list[PromptParam] = []
