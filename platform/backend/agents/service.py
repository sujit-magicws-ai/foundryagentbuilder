"""Agent deployment and management service."""

from __future__ import annotations

import json
import logging
import tempfile
from pathlib import Path
from typing import Any

from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import PromptAgentDefinition
from azure.core.exceptions import HttpResponseError, ResourceNotFoundError

from agents.schemas import AgentCreate, AgentResponse, PromptParam
from exceptions import AzureServiceError, NotFoundError
from tools.service import build_runtime_instructions, build_sdk_tools

logger = logging.getLogger(__name__)

_PARAMS_STORE_PATH = Path(__file__).parent / "prompt_params_store.json"


def _load_params_store() -> dict[str, Any]:
    if _PARAMS_STORE_PATH.exists():
        with open(_PARAMS_STORE_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_params_store(store: dict[str, Any]) -> None:
    tmp_fd, tmp_path = tempfile.mkstemp(
        dir=_PARAMS_STORE_PATH.parent, suffix=".tmp", prefix="params_"
    )
    try:
        with open(tmp_fd, "w", encoding="utf-8") as f:
            json.dump(store, f, indent=2, ensure_ascii=False)
            f.write("\n")
        Path(tmp_path).replace(_PARAMS_STORE_PATH)
    except Exception:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass
        raise


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

        # Persist prompt_params to local store
        if request.prompt_params:
            store = _load_params_store()
            store[request.name] = [p.model_dump() for p in request.prompt_params]
            _save_params_store(store)

        return AgentResponse(
            name=agent.name,
            id=agent.id,
            version=int(agent.version),
            description="Deployed via Agent Builder Platform",
            prompt_params=request.prompt_params,
        )
    except HttpResponseError as exc:
        logger.error("Azure error deploying agent: %s", exc.message)
        raise AzureServiceError(f"Failed to deploy agent: {exc.message}") from exc
    except Exception as exc:
        logger.error("Error deploying agent: %s", exc)
        raise AzureServiceError(f"Failed to deploy agent: {exc}") from exc


def _extract_agent_info(
    a: Any, params_store: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Extract agent info, handling both list and get response shapes."""
    latest = (a.get("versions") or {}).get("latest") or {}
    info: dict[str, Any] = {
        "name": a.name,
        "id": latest.get("id", a.id),
        "version": int(latest.get("version", 0)),
        "description": latest.get("description") or getattr(a, "description", None),
    }
    if params_store and a.name in params_store:
        info["prompt_params"] = [
            PromptParam(**p) for p in params_store[a.name]
        ]
    return info


def list_agents(client: AIProjectClient) -> list[dict[str, Any]]:
    """List all portal agents."""
    try:
        agents = client.agents.list()
        store = _load_params_store()
        return [_extract_agent_info(a, store) for a in agents]
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
        store = _load_params_store()
        return _extract_agent_info(a, store)
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

        # Clean up prompt_params from local store
        store = _load_params_store()
        if agent_name in store:
            del store[agent_name]
            _save_params_store(store)
    except ResourceNotFoundError as exc:
        raise NotFoundError(f"Agent '{agent_name}' not found") from exc
    except HttpResponseError as exc:
        logger.error("Azure error deleting agent: %s", exc.message)
        raise AzureServiceError(f"Failed to delete agent: {exc.message}") from exc
    except Exception as exc:
        logger.error("Error deleting agent: %s", exc)
        raise AzureServiceError(f"Failed to delete agent: {exc}") from exc
