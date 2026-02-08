"""Tool catalog API routes."""

from fastapi import APIRouter, Response

from tools import service
from tools.schemas import HealthResult, ToolCreate, ToolDetail, ToolSummary, ToolUpdate

router = APIRouter(prefix="/api/tools", tags=["tools"])


@router.get("", response_model=list[ToolSummary])
def list_tools():
    return service.list_tools()


@router.get("/{tool_id}", response_model=ToolDetail)
def get_tool(tool_id: str):
    return service.get_tool(tool_id)


@router.get("/{tool_id}/health", response_model=HealthResult)
def check_health(tool_id: str):
    return service.check_health(tool_id)


@router.post("", response_model=ToolDetail, status_code=201)
def create_tool(tool: ToolCreate):
    return service.create_tool(tool.model_dump())


@router.put("/{tool_id}", response_model=ToolDetail)
def update_tool(tool_id: str, tool: ToolUpdate):
    updates = tool.model_dump(exclude_none=True)
    return service.update_tool(tool_id, updates)


@router.delete("/{tool_id}", status_code=204)
def delete_tool(tool_id: str):
    service.delete_tool(tool_id)
    return Response(status_code=204)
