"""Agent deployment and management API routes."""

from fastapi import APIRouter, Request, Response

from agents import service
from agents.schemas import AgentCreate, AgentResponse

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.post("", response_model=AgentResponse, status_code=201)
def deploy_agent(body: AgentCreate, request: Request):
    client = request.app.state.ai_client
    return service.deploy(client, body)


@router.get("", response_model=list[AgentResponse])
def list_agents(request: Request):
    client = request.app.state.ai_client
    return service.list_agents(client)


@router.get("/{agent_name}", response_model=AgentResponse)
def get_agent(agent_name: str, request: Request):
    client = request.app.state.ai_client
    return service.get_agent(client, agent_name)


@router.delete("/{agent_name}", status_code=204)
def delete_agent(agent_name: str, request: Request):
    client = request.app.state.ai_client
    service.delete_agent(client, agent_name)
    return Response(status_code=204)
