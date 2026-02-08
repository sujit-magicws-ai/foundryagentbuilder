"""Agent deployment and management service."""

from __future__ import annotations

import logging
from typing import Any

from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import PromptAgentDefinition
from azure.core.exceptions import HttpResponseError, ResourceNotFoundError

from agents.schemas import AgentCreate, AgentResponse
from exceptions import AzureServiceError, NotFoundError
from tools.service import build_runtime_instructions, build_sdk_tools

logger = logging.getLogger(__name__)


def deploy(client: AIProjectClient, request: AgentCreate) -> AgentResponse:
    """Deploy an agent to the Foundry portal via create_version()."""
    try:
        sdk_tools = build_sdk_tools([t.model_dump() for t in request.tools])
        instructions = build_runtime_instructions(
            [t.model_dump() for t in request.tools], request.instructions
        )

        agent = client.agents.create_version(
            agent_name=request.name,
            definition=PromptAgentDefinition(
                model=request.model,
                instructions=instructions,
                tools=sdk_tools,
            ),
            description=f"Deployed via Agent Builder Platform",
        )

        logger.info("Deployed agent '%s' v%s", agent.name, agent.version)
        return AgentResponse(
            name=agent.name,
            id=agent.id,
            version=int(agent.version),
            description="Deployed via Agent Builder Platform",
        )
    except HttpResponseError as exc:
        logger.error("Azure error deploying agent: %s", exc.message)
        raise AzureServiceError(f"Failed to deploy agent: {exc.message}") from exc
    except Exception as exc:
        logger.error("Error deploying agent: %s", exc)
        raise AzureServiceError(f"Failed to deploy agent: {exc}") from exc


def _extract_agent_info(a: Any) -> dict[str, Any]:
    """Extract agent info, handling both list and get response shapes."""
    latest = (a.get("versions") or {}).get("latest") or {}
    return {
        "name": a.name,
        "id": latest.get("id", a.id),
        "version": int(latest.get("version", 0)),
        "description": latest.get("description") or getattr(a, "description", None),
    }


def list_agents(client: AIProjectClient) -> list[dict[str, Any]]:
    """List all portal agents."""
    try:
        agents = client.agents.list()
        return [_extract_agent_info(a) for a in agents]
    except HttpResponseError as exc:
        logger.error("Azure error listing agents: %s", exc.message)
        raise AzureServiceError(f"Failed to list agents: {exc.message}") from exc
    except Exception as exc:
        logger.error("Error listing agents: %s", exc)
        raise AzureServiceError(f"Failed to list agents: {exc}") from exc


def get_agent(client: AIProjectClient, agent_name: str) -> dict[str, Any]:
    """Get a specific agent by name."""
    try:
        a = client.agents.get(agent_name=agent_name)
        return _extract_agent_info(a)
    except ResourceNotFoundError as exc:
        raise NotFoundError(f"Agent '{agent_name}' not found") from exc
    except HttpResponseError as exc:
        logger.error("Azure error getting agent: %s", exc.message)
        raise AzureServiceError(f"Failed to get agent: {exc.message}") from exc
    except Exception as exc:
        logger.error("Error getting agent: %s", exc)
        raise AzureServiceError(f"Failed to get agent: {exc}") from exc


def delete_agent(client: AIProjectClient, agent_name: str) -> None:
    """Delete all versions of an agent."""
    try:
        client.agents.delete(agent_name=agent_name)
        logger.info("Deleted agent '%s'", agent_name)
    except ResourceNotFoundError as exc:
        raise NotFoundError(f"Agent '{agent_name}' not found") from exc
    except HttpResponseError as exc:
        logger.error("Azure error deleting agent: %s", exc.message)
        raise AzureServiceError(f"Failed to delete agent: {exc.message}") from exc
    except Exception as exc:
        logger.error("Error deleting agent: %s", exc)
        raise AzureServiceError(f"Failed to delete agent: {exc}") from exc
