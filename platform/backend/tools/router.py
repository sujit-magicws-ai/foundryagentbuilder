"""Tool catalog API routes."""

from fastapi import APIRouter

from tools import service
from tools.schemas import ToolDetail, ToolSummary

router = APIRouter(prefix="/api/tools", tags=["tools"])


@router.get("", response_model=list[ToolSummary])
def list_tools():
    return service.list_tools()


@router.get("/{tool_id}", response_model=ToolDetail)
def get_tool(tool_id: str):
    return service.get_tool(tool_id)
