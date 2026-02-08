"""Chat proxy service — forwards messages to deployed agents via Responses API."""

from __future__ import annotations

import logging
from typing import Any

from azure.ai.projects import AIProjectClient
from azure.core.exceptions import HttpResponseError

from config import get_settings
from exceptions import AzureServiceError

logger = logging.getLogger(__name__)


def _get_agent_model(client: AIProjectClient, agent_name: str) -> str:
    """Get the model deployment name from the agent definition."""
    try:
        a = client.agents.get(agent_name=agent_name)
        latest = (a.get("versions") or {}).get("latest") or {}
        definition = latest.get("definition") or {}
        return definition.get("model", get_settings().azure_ai_model_deployment_name)
    except Exception:
        return get_settings().azure_ai_model_deployment_name


def send_message(
    client: AIProjectClient,
    agent_name: str,
    message: str,
    previous_response_id: str | None = None,
) -> dict[str, Any]:
    """Send a message to a deployed agent and return the response."""
    try:
        openai_client = client.get_openai_client()
        model = _get_agent_model(client, agent_name)

        kwargs: dict[str, Any] = {
            "model": model,
            "input": [{"role": "user", "content": message}],
            "extra_body": {
                "agent": {"name": agent_name, "type": "agent_reference"},
            },
        }
        if previous_response_id:
            kwargs["previous_response_id"] = previous_response_id

        response = openai_client.responses.create(**kwargs)

        # Extract assistant text and tool call info
        text = ""
        tool_calls: list[str] = []
        for item in response.output:
            if item.type == "message":
                for content in item.content:
                    if hasattr(content, "text"):
                        text += content.text
            elif item.type in (
                "function_call",
                "mcp_call",
                "code_interpreter_call",
                "web_search_call",
            ):
                name = getattr(item, "name", None) or item.type
                tool_calls.append(name)
            # Skip mcp_list_tools — internal MCP protocol step, not a real tool call

        return {
            "text": text,
            "response_id": response.id,
            "tool_calls": tool_calls,
        }
    except HttpResponseError as exc:
        logger.error("Azure error in chat: %s", exc.message)
        raise AzureServiceError(f"Chat failed: {exc.message}") from exc
    except Exception as exc:
        logger.error("Chat error: %s", exc)
        raise AzureServiceError(f"Chat failed: {exc}") from exc
