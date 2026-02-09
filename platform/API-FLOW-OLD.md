# Agent Builder Platform — API Flow Reference

## Swagger / OpenAPI Docs

- **Swagger UI (interactive):** https://foundryskill-platform.azurewebsites.net/docs
- **ReDoc:** https://foundryskill-platform.azurewebsites.net/redoc
- **Raw OpenAPI JSON:** https://foundryskill-platform.azurewebsites.net/openapi.json

Base URL: `https://foundryskill-platform.azurewebsites.net`

All endpoints are prefixed with `/api`. CORS is enabled for `http://localhost:3000`.

---

## Application Flow

The platform has two pages:

1. **Agent List Page** (`/index.html`) — Lists all deployed agents
2. **Builder Wizard** (`/builder.html`) — 5-step flow to build, deploy, and chat with an agent

There is also a **chat-only shortcut**: `/builder.html?agent={agent_name}` — skips directly to Step 5 (Chat) for an existing agent.

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  AGENT LIST PAGE (/index.html)                                         │
│                                                                         │
│  GET /api/agents  ──►  Show grid of deployed agents                    │
│                        Click card ──► /builder.html?agent={name}       │
│                        "+ Create New Agent" ──► /builder.html          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: SELECT TOOLS                                                   │
│                                                                         │
│  GET /api/tools                  Load tool catalog                     │
│  GET /api/tools/{id}/health      "Test" button — check tool health     │
│  POST /api/tools                 "+ Add Custom Tool" — create tool     │
│  PUT /api/tools/{id}             "Edit" button — update custom tool    │
│  DELETE /api/tools/{id}          "Del" button — delete custom tool     │
│                                                                         │
│  User selects 1+ tools, clicks "Next"                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 2: CONFIGURE PARAMETERS                                           │
│                                                                         │
│  GET /api/tools/{id}             Fetch full tool detail for each       │
│                                  selected tool (deploy_params,         │
│                                  runtime_params with UI metadata)      │
│                                                                         │
│  User fills in parameter values, clicks "Next"                         │
│  (No API calls — params stored in frontend state)                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 3: AGENT CONFIG                                                   │
│                                                                         │
│  No API calls — user enters:                                           │
│    • Agent name                                                        │
│    • Model (dropdown)                                                  │
│    • Instructions (textarea)                                           │
│                                                                         │
│  Shows summary of tools + params, clicks "Deploy Agent"                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 4: DEPLOY                                                         │
│                                                                         │
│  POST /api/agents                Deploy agent to Azure AI Foundry      │
│                                  (shows spinner while deploying)       │
│                                                                         │
│  On success → auto-advance to Step 5                                   │
│  On failure → show error with "Back to Config" button                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 5: CHAT                                                           │
│                                                                         │
│  POST /api/chat                  Send message, get response            │
│                                  (with conversation threading)         │
│                                                                         │
│  GET /api/agents/{name}          Fetch agent details (chat-only mode)  │
│  DELETE /api/agents/{name}       "Delete Agent" button                 │
│                                                                         │
│  "Update Agent" → resets to Step 1 (preserves selected tools)          │
│  "New Agent" → fresh /builder.html                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints — Detailed Reference

### 1. Tools

#### `GET /api/tools` — List all tools
Returns the tool catalog (built-in + custom tools).

**Response:** `200 OK`
```json
[
  {
    "id": "mock-weather",
    "name": "Weather API",
    "description": "Get current weather for any city",
    "type": "openapi",
    "category": "utilities",
    "icon": "cloud",
    "source": "builtin"
  }
]
```

| Field | Type | Values |
|-------|------|--------|
| `id` | string | URL-safe identifier |
| `name` | string | Display name |
| `description` | string | Short description |
| `type` | string | `"openapi"` \| `"mcp"` \| `"builtin"` |
| `category` | string | Grouping category (e.g. `"utilities"`, `"knowledge"`, `"compute"`) |
| `icon` | string | Icon key: `cloud`, `dollar`, `book`, `github`, `code`, `scan`, `wrench` |
| `source` | string | `"builtin"` (read-only) \| `"custom"` (editable/deletable) |

---

#### `GET /api/tools/{tool_id}` — Get tool details
Returns full tool config including parameter definitions used to render the configuration form in Step 2.

**Response:** `200 OK`
```json
{
  "id": "mock-weather",
  "name": "Weather API",
  "description": "Get current weather for any city",
  "type": "openapi",
  "category": "utilities",
  "icon": "cloud",
  "source": "builtin",
  "deploy_params": {
    "spec_url": {
      "label": "OpenAPI Spec URL",
      "type": "string",
      "default": "https://foundryskill-mock-apis.azurewebsites.net/openapi.json",
      "required": true
    },
    "operations": {
      "label": "Operations to include",
      "type": "multi_select",
      "options": ["getWeather"],
      "default": ["getWeather"],
      "required": true
    },
    "auth_type": {
      "label": "Authentication",
      "type": "select",
      "options": ["anonymous", "project_connection", "managed_identity"],
      "default": "anonymous",
      "required": true
    },
    "project_connection_id": {
      "label": "Project Connection",
      "type": "connection_picker",
      "default": "",
      "required": false,
      "show_if": { "auth_type": "project_connection" },
      "description": "Select a connection from your Azure AI Foundry project"
    }
  },
  "runtime_params": {
    "default_units": {
      "label": "Temperature units",
      "type": "select",
      "options": ["fahrenheit", "celsius"],
      "default": "fahrenheit",
      "required": false,
      "inject_into": "instructions"
    },
    "default_location": {
      "label": "Default city (if user doesn't specify)",
      "type": "string",
      "default": "",
      "required": false,
      "placeholder": "e.g. Seattle",
      "inject_into": "instructions"
    }
  }
}
```

**Parameter field metadata (for rendering forms):**

| Meta field | Type | Description |
|------------|------|-------------|
| `label` | string | Human-readable label for the form field |
| `type` | string | `"string"` \| `"select"` \| `"multi_select"` \| `"password"` \| `"connection_picker"` |
| `default` | any | Default value (string, array, or empty) |
| `required` | boolean | Whether the field is mandatory |
| `options` | string[] | Available choices (for `select` / `multi_select`) |
| `placeholder` | string | Input placeholder text |
| `description` | string | Help text below the field |
| `show_if` | object | Conditional visibility: `{ "other_field_key": "required_value" }` |
| `inject_into` | string | Where value is used at deploy time (e.g. `"instructions"`) |

**Error:** `404` if tool not found
```json
{ "error": { "code": "NOT_FOUND", "message": "Tool 'xyz' not found" } }
```

---

#### `GET /api/tools/{tool_id}/health` — Check tool health
Tests connectivity/validity of a tool's external service.

**Response:** `200 OK`
```json
{
  "tool_id": "mock-weather",
  "status": "healthy",
  "message": "Valid OpenAPI 3.0.2 spec with 4 operations",
  "details": {
    "spec_version": "3.0.2",
    "title": "Mock APIs",
    "operation_count": 4,
    "response_time_ms": 340
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `tool_id` | string | Tool ID that was checked |
| `status` | string | `"healthy"` or `"unhealthy"` |
| `message` | string | Human-readable status message |
| `details` | object | Extra info (varies by type — may include `response_time_ms`, `spec_version`, `server_url`, `status_code`) |

Health check logic by tool type:
- **openapi** → Fetches the `spec_url`, validates it's valid JSON with `openapi` field
- **mcp** → HTTP GET to `server_url`, accepts any 2xx/3xx/405 as healthy
- **builtin** → Always returns healthy

**Error:** `404` if tool not found

---

#### `POST /api/tools` — Create a custom tool
Adds a new tool to the catalog.

**Request:**
```json
{
  "id": "my-custom-api",
  "name": "My Custom API",
  "description": "Does something useful",
  "type": "openapi",
  "category": "utilities",
  "icon": "wrench",
  "deploy_params": {
    "spec_url": {
      "label": "OpenAPI Spec URL",
      "type": "string",
      "default": "https://api.example.com/openapi.json",
      "required": true
    }
  },
  "runtime_params": {}
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `id` | string | yes | `^[a-z0-9-]+$`, 1–50 chars, must be unique |
| `name` | string | yes | 1–100 chars |
| `description` | string | yes | non-empty |
| `type` | string | yes | `"openapi"` \| `"mcp"` \| `"builtin"` |
| `category` | string | yes | non-empty |
| `icon` | string | no | default: `"wrench"` |
| `deploy_params` | object | no | default: `{}` |
| `runtime_params` | object | no | default: `{}` |

**Response:** `201 Created` — returns full `ToolDetail` (same shape as GET /api/tools/{id})

**Errors:**
- `422` — Validation error (missing fields, invalid ID format, invalid type, duplicate ID)

---

#### `PUT /api/tools/{tool_id}` — Update a custom tool
Partially updates a tool. Only custom tools can be updated.

**Request:** (all fields optional, only send what changed)
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "category": "new-category",
  "icon": "cloud",
  "deploy_params": { ... },
  "runtime_params": { ... }
}
```

**Response:** `200 OK` — returns updated `ToolDetail`

**Errors:**
- `404` — Tool not found
- `422` — Validation error (e.g. trying to update a builtin tool)

---

#### `DELETE /api/tools/{tool_id}` — Delete a custom tool
Removes a custom tool from the catalog. Built-in tools cannot be deleted.

**Response:** `204 No Content` (empty body)

**Errors:**
- `404` — Tool not found
- `422` — Cannot delete builtin tool

---

### 2. Agents

#### `GET /api/agents` — List deployed agents
Returns all agents deployed to Azure AI Foundry.

**Response:** `200 OK`
```json
[
  {
    "name": "my-weather-bot",
    "id": "asst_abc123def456",
    "version": 3,
    "description": "Agent with Weather API, Code Interpreter"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Agent name (unique identifier in Foundry) |
| `id` | string | Azure resource ID |
| `version` | integer | Latest version number |
| `description` | string \| null | Auto-generated description listing tools |

---

#### `GET /api/agents/{agent_name}` — Get agent details

**Response:** `200 OK` — same shape as list item above

**Error:** `404` if agent not found

---

#### `POST /api/agents` — Deploy agent
Creates (or updates) an agent in Azure AI Foundry. If an agent with the same name exists, a new version is created.

**Request:**
```json
{
  "name": "my-weather-bot",
  "model": "gpt-4.1",
  "instructions": "You are a helpful weather assistant...",
  "tools": [
    {
      "tool_id": "mock-weather",
      "deploy_params": {
        "spec_url": "https://foundryskill-mock-apis.azurewebsites.net/openapi.json",
        "operations": ["getWeather"],
        "auth_type": "anonymous"
      },
      "runtime_params": {
        "default_units": "celsius",
        "default_location": "Seattle"
      }
    },
    {
      "tool_id": "code-interpreter",
      "deploy_params": {},
      "runtime_params": {}
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Agent name (1–100 chars) |
| `model` | string | no | Model deployment name (default: `"gpt-4.1"`) |
| `instructions` | string | yes | System prompt for the agent |
| `tools` | ToolSelection[] | yes | Array of tool selections with their configured params |

**ToolSelection:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tool_id` | string | yes | Tool ID from the catalog |
| `deploy_params` | object | no | Flat key-value map of deploy parameter values |
| `runtime_params` | object | no | Flat key-value map of runtime parameter values |

Note: `deploy_params` here contains **resolved values** (e.g. `"spec_url": "https://..."`) not the metadata objects from the tool detail endpoint.

**Response:** `201 Created`
```json
{
  "name": "my-weather-bot",
  "id": "asst_abc123def456",
  "version": 1,
  "description": "Agent with Weather API, Code Interpreter"
}
```

**Errors:**
- `422` — Validation error
- `502` — Azure service error (Foundry API failure)

---

#### `DELETE /api/agents/{agent_name}` — Delete agent
Deletes all versions of the agent from Azure AI Foundry.

**Response:** `204 No Content`

**Errors:**
- `404` — Agent not found
- `502` — Azure service error

---

### 3. Chat

#### `POST /api/chat` — Send a message
Sends a message to a deployed agent and returns the response.

**Request:**
```json
{
  "agent_name": "my-weather-bot",
  "message": "What's the weather in Seattle?",
  "previous_response_id": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `agent_name` | string | yes | Name of the deployed agent |
| `message` | string | yes | User's message text |
| `previous_response_id` | string \| null | no | Response ID from last turn (for multi-turn conversation). `null` for first message. |

**Response:** `200 OK`
```json
{
  "text": "The current weather in Seattle is 58°F with partly cloudy skies.",
  "response_id": "resp_abc123",
  "tool_calls": ["getWeather"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | Assistant's response (may contain **Markdown**) |
| `response_id` | string | Pass this as `previous_response_id` in the next turn |
| `tool_calls` | string[] | Names of tools the agent invoked (empty if none) |

**Conversation threading:** Pass the `response_id` from each response as `previous_response_id` in the next request to maintain context. Omit or send `null` to start a new conversation.

**Errors:**
- `404` — Agent not found
- `502` — Azure service error (model failure, timeout, etc.)

---

## Error Response Format

All errors follow this shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

| HTTP Status | Code | When |
|-------------|------|------|
| 404 | `NOT_FOUND` | Resource doesn't exist |
| 422 | `VALIDATION_ERROR` | Invalid input |
| 502 | `AZURE_SERVICE_ERROR` | Azure AI Foundry API failure |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## CORS

The API allows requests from `http://localhost:3000` (and other origins listed in config). If your React dev server runs on a different port, the backend `CORS_ORIGINS` setting will need updating.

---

## Notes for Frontend Development

1. **Markdown in chat responses** — `text` in chat responses may contain Markdown (headers, code blocks, lists, tables, bold, links). Render it with a Markdown library and sanitize for XSS.

2. **Tool parameter forms are data-driven** — The `deploy_params` and `runtime_params` in tool details contain UI metadata (`type`, `label`, `options`, `show_if`, etc.) that define how to render each form field. The frontend should dynamically generate forms from this metadata.

3. **Conditional field visibility** — Some fields have `show_if: { "other_key": "value" }`. Only show these fields when the referenced field matches the specified value.

4. **Builtin vs custom tools** — Tools with `source: "builtin"` are read-only (no edit/delete). Tools with `source: "custom"` support full CRUD.

5. **Deploy params: metadata vs values** — `GET /api/tools/{id}` returns parameter **metadata** (label, type, options, defaults). `POST /api/agents` expects parameter **values** (flat key-value pairs). The frontend maps defaults + user overrides into the flat value format at deploy time.

6. **Agent versioning** — Deploying an agent with an existing name creates a new version (doesn't fail). The response contains the new version number.

7. **Chat-only mode** — Navigate to `/builder.html?agent={name}` to skip the wizard and go straight to chatting with an existing agent.
