"""Pydantic models for tool catalog API responses."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ToolSummary(BaseModel):
    """Lightweight tool info for the catalog list view."""

    id: str
    name: str
    description: str
    type: str
    category: str
    icon: str
    source: str = "builtin"


class ToolDetail(ToolSummary):
    """Full tool info including configurable parameters."""

    deploy_params: dict[str, Any]
    runtime_params: dict[str, Any]


class HealthResult(BaseModel):
    """Result of a tool health check."""

    tool_id: str
    status: str  # "healthy" or "unhealthy"
    message: str
    details: dict[str, Any] = {}


class ToolCreate(BaseModel):
    """Request model for creating a new tool."""

    id: str = Field(..., pattern=r"^[a-z0-9-]+$", min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1)
    type: str = Field(...)  # "openapi", "mcp", "builtin"
    category: str = Field(..., min_length=1)
    icon: str = "wrench"
    deploy_params: dict[str, Any] = {}
    runtime_params: dict[str, Any] = {}


class ToolUpdate(BaseModel):
    """Request model for updating an existing tool."""

    name: str | None = None
    description: str | None = None
    category: str | None = None
    icon: str | None = None
    deploy_params: dict[str, Any] | None = None
    runtime_params: dict[str, Any] | None = None
