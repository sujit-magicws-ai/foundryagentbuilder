"""Pydantic models for tool catalog API responses."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ToolSummary(BaseModel):
    """Lightweight tool info for the catalog list view."""

    id: str
    name: str
    description: str
    type: str
    category: str
    icon: str


class ToolDetail(ToolSummary):
    """Full tool info including configurable parameters."""

    deploy_params: dict[str, Any]
    runtime_params: dict[str, Any]
