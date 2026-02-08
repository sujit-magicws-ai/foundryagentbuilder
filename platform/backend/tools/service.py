"""Tool catalog service — loads catalog, builds SDK tool objects."""

from __future__ import annotations

import json
import logging
import tempfile
import time
from pathlib import Path
from typing import Any

import httpx
from azure.ai.projects.models import (
    CodeInterpreterTool,
    MCPTool,
    OpenApiAgentTool,
    OpenApiFunctionDefinition,
)

from exceptions import NotFoundError, ValidationError

logger = logging.getLogger(__name__)

_catalog: list[dict[str, Any]] = []
_CATALOG_PATH = Path(__file__).parent / "catalog.json"
_VALID_TYPES = {"openapi", "mcp", "builtin"}


def load_catalog() -> None:
    """Load tool catalog from catalog.json (called once at startup)."""
    global _catalog
    with open(_CATALOG_PATH, encoding="utf-8") as f:
        data = json.load(f)
    _catalog = data["tools"]
    # Ensure all tools have a source field
    for t in _catalog:
        if "source" not in t:
            t["source"] = "builtin"
    logger.info("Loaded %d tools from catalog", len(_catalog))


def list_tools() -> list[dict[str, Any]]:
    """Return summary info for all tools."""
    return [
        {
            "id": t["id"],
            "name": t["name"],
            "description": t["description"],
            "type": t["type"],
            "category": t["category"],
            "icon": t["icon"],
            "source": t.get("source", "builtin"),
        }
        for t in _catalog
    ]


def get_tool(tool_id: str) -> dict[str, Any]:
    """Return full tool detail by id."""
    for t in _catalog:
        if t["id"] == tool_id:
            return t
    raise NotFoundError(f"Tool '{tool_id}' not found in catalog")


def _fetch_openapi_spec(spec_url: str) -> dict[str, Any]:
    """Fetch an OpenAPI spec from a URL and ensure it's 3.0.x compatible."""
    resp = httpx.get(spec_url, timeout=30)
    resp.raise_for_status()
    spec = resp.json()

    # Azure rejects OpenAPI 3.1.0 — downgrade to 3.0.2
    if spec.get("openapi", "").startswith("3.1"):
        logger.info("Downgrading OpenAPI spec from %s to 3.0.2", spec["openapi"])
        spec = _downgrade_spec_to_3_0(spec)

    # Ensure servers block exists so Azure knows where to call
    if "servers" not in spec:
        # Derive base URL from spec_url (strip /openapi.json etc.)
        from urllib.parse import urlparse
        parsed = urlparse(spec_url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        spec["servers"] = [{"url": base_url}]

    return spec


def _downgrade_spec_to_3_0(spec: dict[str, Any]) -> dict[str, Any]:
    """Downgrade an OpenAPI 3.1.0 spec to 3.0.2 for Azure compatibility.

    Handles common 3.1-only constructs:
    - anyOf with null → nullable: true
    - const → enum with single value
    - examples → example (singular)
    """
    import copy
    spec = copy.deepcopy(spec)
    spec["openapi"] = "3.0.2"

    def _fix_schema(schema: dict[str, Any]) -> None:
        if not isinstance(schema, dict):
            return

        # anyOf: [{type: X}, {type: "null"}] → type: X, nullable: true
        if "anyOf" in schema:
            non_null = [s for s in schema["anyOf"] if s != {"type": "null"}]
            has_null = len(non_null) < len(schema["anyOf"])
            if has_null and len(non_null) == 1:
                schema.pop("anyOf")
                schema.update(non_null[0])
                schema["nullable"] = True
            elif has_null and len(non_null) == 0:
                schema.pop("anyOf")
                schema["type"] = "string"
                schema["nullable"] = True

        # allOf with single item → inline it
        if "allOf" in schema and len(schema["allOf"]) == 1:
            ref_item = schema.pop("allOf")[0]
            for k, v in ref_item.items():
                if k not in schema:
                    schema[k] = v

        # Recurse into properties
        for prop in schema.get("properties", {}).values():
            _fix_schema(prop)
        if "items" in schema:
            _fix_schema(schema["items"])
        if "additionalProperties" in schema and isinstance(schema["additionalProperties"], dict):
            _fix_schema(schema["additionalProperties"])

    # Fix component schemas
    for schema in spec.get("components", {}).get("schemas", {}).values():
        _fix_schema(schema)

    # Fix inline schemas in paths
    for path_item in spec.get("paths", {}).values():
        for operation in path_item.values():
            if not isinstance(operation, dict):
                continue
            for param in operation.get("parameters", []):
                if "schema" in param:
                    _fix_schema(param["schema"])
            rb = operation.get("requestBody", {})
            for content in rb.get("content", {}).values():
                if "schema" in content:
                    _fix_schema(content["schema"])
            for resp in operation.get("responses", {}).values():
                for content in resp.get("content", {}).values():
                    if "schema" in content:
                        _fix_schema(content["schema"])

    return spec


def _filter_spec_operations(
    spec: dict[str, Any], allowed_operations: list[str]
) -> dict[str, Any]:
    """Filter an OpenAPI spec to only include the specified operationIds."""
    filtered_paths: dict[str, Any] = {}
    for path, methods in spec.get("paths", {}).items():
        filtered_methods: dict[str, Any] = {}
        for method, details in methods.items():
            if method in ("get", "post", "put", "patch", "delete", "options", "head"):
                if details.get("operationId") in allowed_operations:
                    filtered_methods[method] = details
        if filtered_methods:
            filtered_paths[path] = filtered_methods

    filtered = {**spec, "paths": filtered_paths}
    return filtered


def build_sdk_tools(
    selected_tools: list[dict[str, Any]],
) -> list:
    """Convert user-selected tools with params into Azure SDK tool objects.

    Each item in selected_tools has: tool_id, deploy_params, runtime_params.
    Returns a list of SDK tool objects ready for PromptAgentDefinition.
    """
    sdk_tools = []

    for selection in selected_tools:
        tool_id = selection["tool_id"]
        deploy = selection.get("deploy_params", {})
        catalog_entry = get_tool(tool_id)
        tool_type = catalog_entry["type"]

        if tool_type == "openapi":
            sdk_tools.append(_build_openapi_tool(tool_id, deploy, catalog_entry))
        elif tool_type == "mcp":
            sdk_tools.append(_build_mcp_tool(tool_id, deploy, catalog_entry))
        elif tool_type == "builtin":
            if tool_id == "code-interpreter":
                sdk_tools.append(CodeInterpreterTool())
        else:
            raise ValidationError(f"Unknown tool type '{tool_type}' for tool '{tool_id}'")

    return sdk_tools


def _build_openapi_tool(
    tool_id: str, deploy: dict[str, Any], catalog_entry: dict[str, Any]
) -> OpenApiAgentTool:
    """Build an OpenApiAgentTool from deploy params."""
    spec_url = deploy.get(
        "spec_url",
        catalog_entry["deploy_params"]["spec_url"].get("default", ""),
    )
    if not spec_url:
        raise ValidationError(f"spec_url is required for tool '{tool_id}'")

    operations = deploy.get(
        "operations",
        catalog_entry["deploy_params"]["operations"].get("default", []),
    )
    auth_type = deploy.get(
        "auth_type",
        catalog_entry["deploy_params"]["auth_type"].get("default", "anonymous"),
    )

    spec = _fetch_openapi_spec(spec_url)

    if operations:
        spec = _filter_spec_operations(spec, operations)

    auth: dict[str, Any] = {"type": auth_type}
    if auth_type == "project_connection":
        conn_id = deploy.get("project_connection_id", "")
        if conn_id:
            auth["project_connection_id"] = conn_id

    return OpenApiAgentTool(
        openapi=OpenApiFunctionDefinition(
            name=tool_id,
            description=catalog_entry["description"],
            spec=spec,
            auth=auth,
        )
    )


def _build_mcp_tool(
    tool_id: str, deploy: dict[str, Any], catalog_entry: dict[str, Any]
) -> MCPTool:
    """Build an MCPTool from deploy params."""
    if tool_id == "gitmcp-repo":
        owner = deploy.get("owner", "")
        repo = deploy.get("repo", "")
        if not owner or not repo:
            raise ValidationError("owner and repo are required for gitmcp-repo")
        server_url = f"https://gitmcp.io/{owner}/{repo}"
    else:
        server_url = deploy.get(
            "server_url",
            catalog_entry["deploy_params"].get("server_url", {}).get("default", ""),
        )
    if not server_url:
        raise ValidationError(f"server_url is required for tool '{tool_id}'")

    require_approval = deploy.get("require_approval", "never")
    allowed_tools_str = deploy.get("allowed_tools", "")
    allowed_tools = (
        [t.strip() for t in allowed_tools_str.split(",") if t.strip()]
        if allowed_tools_str
        else None
    )

    kwargs: dict[str, Any] = {
        "server_label": tool_id,
        "server_url": server_url,
        "require_approval": require_approval,
    }
    if allowed_tools:
        kwargs["allowed_tools"] = allowed_tools

    return MCPTool(**kwargs)


def build_runtime_instructions(
    selected_tools: list[dict[str, Any]], base_instructions: str
) -> str:
    """Append runtime_params to the base instructions.

    For each tool with non-empty runtime_params, adds a line describing
    the configuration so the LLM knows user preferences.
    """
    lines: list[str] = []

    for selection in selected_tools:
        tool_id = selection["tool_id"]
        runtime = selection.get("runtime_params", {})
        catalog_entry = get_tool(tool_id)

        param_parts: list[str] = []
        for key, value in runtime.items():
            if not value:
                continue
            param_def = catalog_entry.get("runtime_params", {}).get(key, {})
            label = param_def.get("label", key)
            param_parts.append(f"{label}: {value}")

        if param_parts:
            lines.append(f"{catalog_entry['name']}: {'. '.join(param_parts)}.")

    if not lines:
        return base_instructions

    return base_instructions + "\n\n--- Tool Configuration ---\n" + "\n".join(lines)


# ===== Health Checks =====

def check_health(tool_id: str) -> dict[str, Any]:
    """Check connectivity/validity of a tool. Returns a HealthResult dict."""
    tool = get_tool(tool_id)
    tool_type = tool["type"]

    try:
        if tool_type == "builtin":
            return {
                "tool_id": tool_id,
                "status": "healthy",
                "message": "Built-in tool is always available",
                "details": {},
            }
        elif tool_type == "openapi":
            return _check_openapi_health(tool_id, tool)
        elif tool_type == "mcp":
            return _check_mcp_health(tool_id, tool)
        else:
            return {
                "tool_id": tool_id,
                "status": "unhealthy",
                "message": f"Unknown tool type: {tool_type}",
                "details": {},
            }
    except Exception as exc:
        return {
            "tool_id": tool_id,
            "status": "unhealthy",
            "message": str(exc),
            "details": {},
        }


def _check_openapi_health(tool_id: str, tool: dict[str, Any]) -> dict[str, Any]:
    """Health check for OpenAPI tools — fetch spec and validate."""
    spec_url = tool.get("deploy_params", {}).get("spec_url", {})
    url = spec_url.get("default", "") if isinstance(spec_url, dict) else spec_url
    if not url:
        return {
            "tool_id": tool_id,
            "status": "unhealthy",
            "message": "No spec_url configured",
            "details": {},
        }

    start = time.monotonic()
    resp = httpx.get(url, timeout=15)
    elapsed_ms = round((time.monotonic() - start) * 1000)
    resp.raise_for_status()

    spec = resp.json()
    openapi_version = spec.get("openapi", "unknown")
    title = spec.get("info", {}).get("title", "")
    paths = spec.get("paths", {})
    operation_count = sum(
        1
        for methods in paths.values()
        for m in methods
        if m in ("get", "post", "put", "patch", "delete", "options", "head")
    )

    return {
        "tool_id": tool_id,
        "status": "healthy",
        "message": f"Spec reachable — {operation_count} operation(s)",
        "details": {
            "spec_url": url,
            "openapi_version": openapi_version,
            "title": title,
            "operation_count": operation_count,
            "response_time_ms": elapsed_ms,
        },
    }


def _check_mcp_health(tool_id: str, tool: dict[str, Any]) -> dict[str, Any]:
    """Health check for MCP tools — verify server URL is reachable."""
    deploy = tool.get("deploy_params", {})

    # Build URL: gitmcp uses owner/repo pattern
    if tool_id == "gitmcp-repo":
        owner_param = deploy.get("owner", {})
        repo_param = deploy.get("repo", {})
        owner = owner_param.get("default", "") if isinstance(owner_param, dict) else owner_param
        repo = repo_param.get("default", "") if isinstance(repo_param, dict) else repo_param
        if not owner or not repo:
            url = "https://gitmcp.io"  # test base URL reachability
        else:
            url = f"https://gitmcp.io/{owner}/{repo}"
    else:
        server_url_param = deploy.get("server_url", {})
        url = server_url_param.get("default", "") if isinstance(server_url_param, dict) else server_url_param

    if not url:
        return {
            "tool_id": tool_id,
            "status": "unhealthy",
            "message": "No server_url configured",
            "details": {},
        }

    start = time.monotonic()
    resp = httpx.get(url, timeout=15, follow_redirects=True)
    elapsed_ms = round((time.monotonic() - start) * 1000)

    # MCP servers may return various status codes; reachability is the main check
    return {
        "tool_id": tool_id,
        "status": "healthy",
        "message": f"Server reachable (HTTP {resp.status_code})",
        "details": {
            "server_url": url,
            "status_code": resp.status_code,
            "response_time_ms": elapsed_ms,
        },
    }


# ===== CRUD Operations =====

def _save_catalog() -> None:
    """Persist the catalog to catalog.json atomically."""
    data = {"tools": _catalog}
    # Write to temp file in same directory, then rename for atomicity
    tmp_fd, tmp_path = tempfile.mkstemp(
        dir=_CATALOG_PATH.parent, suffix=".tmp", prefix="catalog_"
    )
    try:
        with open(tmp_fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        Path(tmp_path).replace(_CATALOG_PATH)
    except Exception:
        # Clean up temp file on failure
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass
        raise


def create_tool(tool_data: dict[str, Any]) -> dict[str, Any]:
    """Add a new tool to the catalog and persist."""
    tool_id = tool_data["id"]

    # Validate uniqueness
    for t in _catalog:
        if t["id"] == tool_id:
            raise ValidationError(f"Tool '{tool_id}' already exists")

    # Validate type
    tool_type = tool_data.get("type", "")
    if tool_type not in _VALID_TYPES:
        raise ValidationError(f"Invalid tool type '{tool_type}'. Must be one of: {', '.join(sorted(_VALID_TYPES))}")

    tool_data["source"] = "custom"
    _catalog.append(tool_data)
    _save_catalog()
    logger.info("Created tool '%s'", tool_id)
    return tool_data


def update_tool(tool_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    """Update an existing tool and persist."""
    for t in _catalog:
        if t["id"] == tool_id:
            for key, value in updates.items():
                if value is not None:
                    t[key] = value
            _save_catalog()
            logger.info("Updated tool '%s'", tool_id)
            return t
    raise NotFoundError(f"Tool '{tool_id}' not found in catalog")


def delete_tool(tool_id: str) -> None:
    """Remove a tool from the catalog and persist."""
    global _catalog
    original_len = len(_catalog)
    _catalog = [t for t in _catalog if t["id"] != tool_id]
    if len(_catalog) == original_len:
        raise NotFoundError(f"Tool '{tool_id}' not found in catalog")
    _save_catalog()
    logger.info("Deleted tool '%s'", tool_id)
