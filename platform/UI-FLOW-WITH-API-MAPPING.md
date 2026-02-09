# Agent Builder Platform — API Flow Reference (V2)

## Swagger / OpenAPI Docs

- **Swagger UI (interactive):** https://foundryskill-platform.azurewebsites.net/docs
- **ReDoc:** https://foundryskill-platform.azurewebsites.net/redoc
- **Raw OpenAPI JSON:** https://foundryskill-platform.azurewebsites.net/openapi.json

Base URL: `https://foundryskill-platform.azurewebsites.net`

All endpoints are prefixed with `/api`. CORS is enabled for `http://localhost:3000`.

> **Terminology note:** The UI uses **"Skills"** throughout. The API endpoints use **`/api/tools`**. They refer to the same resource — treat "Skill" (UI) and "Tool" (API) as synonyms.

---

## Application Structure

The platform has **4 views**:

| View | Route | Description |
|------|-------|-------------|
| **Home** | `/` | Landing page — no API calls. Links to Skills, Agents, Roles (coming soon). |
| **Skills** | `/skills` | Skill catalog with full CRUD, health checks, grouped by type (OpenAPI / MCP / Builtin). |
| **Agents** | `/agents` | List of deployed agents. "+ Create New Agent" launches the Builder. |
| **Builder** | `/builder` | 5-step wizard: Select Skills → Configure → Review → Deploy → Chat |

There is also a **chat-only shortcut**: `/builder?agent={agent_name}` — skips directly to Step 5 (Chat) for an existing agent.

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HOME (/)                                                               │
│                                                                         │
│  No API calls. Three flow cards:                                        │
│    [Skills] ──► /skills                                                 │
│    [Agents] ──► /agents                                                 │
│    [Roles]  ──► Coming Soon (disabled)                                  │
│                                                                         │
│  Four feature cards: Skill Catalog, Visual Agent Builder,               │
│  Azure AI Foundry Deploy, Integrated Playground                         │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│  SKILLS PAGE (/skills)                                                  │
│                                                                         │
│  GET /api/tools                  Load skill catalog (grouped by type)  │
│  GET /api/tools/{id}/health      "Test" button — check skill health    │
│  POST /api/tools                 "+ Add Custom Skill" (full page form) │
│  PUT /api/tools/{id}             "Edit" button (full page form)        │
│  DELETE /api/tools/{id}          "Del" button (confirmation dialog)    │
│                                                                         │
│  Skills are created/edited HERE, not in the Builder.                    │
│  Full page form includes: basic info, connection config,                │
│  deploy parameter builder, runtime parameter builder.                   │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│  AGENTS PAGE (/agents)                                                  │
│                                                                         │
│  GET /api/agents                 Load grid of deployed agents          │
│                                  Click card ──► /builder?agent={name}  │
│                                  "+ Create New Agent" ──► /builder     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BUILDER STEP 1: SELECT SKILLS (3-panel layout)                         │
│                                                                         │
│  GET /api/tools                  Load skill catalog (left panel)       │
│  GET /api/tools/{id}             Fetch full skill detail when          │
│                                  selected (right panel — shows         │
│                                  deploy_params + runtime_params)       │
│  GET /api/tools/{id}/health      "⚡" button on assigned skill         │
│                                                                         │
│  Layout:                                                                │
│    Left panel   — Skill Catalog (grouped: OpenAPI / MCP / Builtin)     │
│    Center panel — Assigned Skills (drag-drop zone)                     │
│    Right panel  — Skill Configuration (params for selected skill)      │
│                                                                         │
│  User drags skills from catalog → center, configures params → right.   │
│  Link: "Manage skills on the Skills page" (no CRUD here).             │
│  Clicks "Next: Configure Agent →"                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BUILDER STEP 2: CONFIGURE AGENT                                        │
│                                                                         │
│  No API calls — user enters:                                           │
│    • Agent name                                                        │
│    • Model (dropdown: gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, etc.)     │
│    • Instructions (textarea — system prompt)                           │
│                                                                         │
│  Shows assigned skills as chips at the top.                             │
│  Clicks "Review & Deploy →"                                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BUILDER STEP 3: REVIEW                                                 │
│                                                                         │
│  No API calls — displays full agent summary:                           │
│    • Agent Details card (name, model, skill count)                     │
│    • Instructions card (formatted, scrollable)                         │
│    • Per-skill detail cards (icon, name, type badge, description,      │
│      all deploy_params and runtime_params with resolved values)        │
│                                                                         │
│  User reviews everything before deploying.                             │
│  "← Back to Configure" or "Deploy to Azure AI Foundry →"              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BUILDER STEP 4: DEPLOY                                                 │
│                                                                         │
│  POST /api/agents                Deploy agent to Azure AI Foundry      │
│                                  (shows spinner while deploying)       │
│                                                                         │
│  On success → shows success card with version + ID                     │
│  On failure → show error with "Back to Configure" button               │
│  Clicks "Start Chatting →"                                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  BUILDER STEP 5: CHAT                                                   │
│                                                                         │
│  POST /api/chat                  Send message, get response            │
│                                  (with conversation threading)         │
│                                                                         │
│  GET /api/agents/{name}          Fetch agent details (chat-only mode)  │
│  DELETE /api/agents/{name}       "Delete Agent" button                 │
│                                                                         │
│  "Update Agent" → resets to Step 1 (new version flow)                  │
│  "New Agent" → fresh /builder                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints — Detailed Reference

### 1. Skills (API: `/api/tools`)

> UI calls these "Skills". API endpoints use "tools". Same resource.

#### `GET /api/tools` — List all skills
Returns the skill catalog (built-in + custom).

**Called from:** Skills page (load catalog), Builder Step 1 (left panel)

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

**UI grouping:** Skills page and Builder catalog group items by `type` with labels: OPENAPI, MCP, BUILTIN.

---

#### `GET /api/tools/{tool_id}` — Get skill details
Returns full skill config including parameter definitions used to render the configuration panel in Builder Step 1.

**Called from:** Builder Step 1 (right panel, when a skill is selected)

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

**UI rendering:** In Builder Step 1, the right panel renders form fields dynamically from this metadata. Each field type maps to a specific input widget. `show_if` controls conditional visibility.

**Error:** `404` if skill not found

---

#### `GET /api/tools/{tool_id}/health` — Check skill health
Tests connectivity/validity of a skill's external service.

**Called from:** Skills page ("Test" button), Builder Step 1 ("⚡" button on assigned skill)

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
| `tool_id` | string | Skill ID that was checked |
| `status` | string | `"healthy"` or `"unhealthy"` |
| `message` | string | Human-readable status message |
| `details` | object | Extra info (varies by type — may include `response_time_ms`, `spec_version`, `server_url`, `status_code`) |

Health check logic by skill type:
- **openapi** → Fetches the `spec_url`, validates it's valid JSON with `openapi` field
- **mcp** → HTTP GET to `server_url`, accepts any 2xx/3xx/405 as healthy
- **builtin** → Always returns healthy

**UI display:** Inline badge on skill cards — green checkmark with response time, or red ✗ with error message.

**Error:** `404` if skill not found

---

#### `POST /api/tools` — Create a custom skill
Adds a new skill to the catalog.

**Called from:** Skills page → "+ Add Custom Skill" (full page form)

The full page form allows defining:
- Basic info (ID, name, description, type, category)
- Connection config (spec URL + auth for OpenAPI, server URL + approval for MCP)
- Custom deploy parameters (via parameter builder — key, label, type, options, default, required)
- Custom runtime parameters (same parameter builder)

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
    },
    "auth_type": {
      "label": "Authentication",
      "type": "select",
      "options": ["anonymous", "project_connection", "managed_identity"],
      "default": "anonymous",
      "required": true
    },
    "custom_param": {
      "label": "Custom Parameter",
      "type": "string",
      "default": "",
      "required": false,
      "description": "User-defined parameter added via the parameter builder",
      "placeholder": "Enter value"
    }
  },
  "runtime_params": {
    "output_format": {
      "label": "Output Format",
      "type": "select",
      "options": ["json", "text", "markdown"],
      "default": "json",
      "required": false
    }
  }
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `id` | string | yes | `^[a-z0-9-]+$`, 1–50 chars, must be unique |
| `name` | string | yes | 1–100 chars |
| `description` | string | yes | non-empty |
| `type` | string | yes | `"openapi"` \| `"mcp"` |
| `category` | string | yes | non-empty |
| `icon` | string | no | default: `"wrench"` |
| `deploy_params` | object | no | default: `{}`. Each value is a parameter metadata object (see metadata table above). |
| `runtime_params` | object | no | default: `{}`. Same format as deploy_params. |

**Note:** For OpenAPI skills, `deploy_params` must include `spec_url` and `auth_type`. For MCP skills, `deploy_params` must include `server_url` and `require_approval`. Additional custom parameters can be added via the parameter builder.

**Response:** `201 Created` — returns full skill detail (same shape as GET /api/tools/{id})

**Errors:**
- `422` — Validation error (missing fields, invalid ID format, invalid type, duplicate ID)

---

#### `PUT /api/tools/{tool_id}` — Update a custom skill
Updates a skill. Only custom skills can be updated. Supports updating all fields including parameters.

**Called from:** Skills page → "Edit" button (full page form, same as add but pre-populated)

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

**Response:** `200 OK` — returns updated skill detail

**Errors:**
- `404` — Skill not found
- `422` — Validation error (e.g. trying to update a builtin skill)

---

#### `DELETE /api/tools/{tool_id}` — Delete a custom skill
Removes a custom skill from the catalog. Built-in skills cannot be deleted.

**Called from:** Skills page → "Del" button (confirmation dialog)

**Response:** `204 No Content` (empty body)

**Errors:**
- `404` — Skill not found
- `422` — Cannot delete builtin skill

---

### 2. Agents

#### `GET /api/agents` — List deployed agents
Returns all agents deployed to Azure AI Foundry.

**Called from:** Agents page (load grid)

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
| `description` | string \| null | Auto-generated description listing skills |

---

#### `GET /api/agents/{agent_name}` — Get agent details

**Called from:** Builder Step 5 (chat-only mode via `/builder?agent={name}`)

**Response:** `200 OK` — same shape as list item above

**Error:** `404` if agent not found

---

#### `POST /api/agents` — Deploy agent
Creates (or updates) an agent in Azure AI Foundry. If an agent with the same name exists, a new version is created.

**Called from:** Builder Step 4 (Deploy)

The request payload is assembled from:
- Step 1: selected skills + configured parameter values
- Step 2: agent name, model, instructions
- Step 3: user reviews everything, clicks "Deploy to Azure AI Foundry"

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
| `tools` | ToolSelection[] | yes | Array of skill selections with their configured params |

**ToolSelection:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tool_id` | string | yes | Skill ID from the catalog |
| `deploy_params` | object | no | Flat key-value map of deploy parameter values |
| `runtime_params` | object | no | Flat key-value map of runtime parameter values |

> **Important:** `deploy_params` here contains **resolved values** (e.g. `"spec_url": "https://..."`) not the metadata objects from the skill detail endpoint. The frontend maps defaults + user overrides into the flat value format at deploy time.

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

**Called from:** Builder Step 5 (Chat) → "Delete Agent" button

**Response:** `204 No Content`

**Errors:**
- `404` — Agent not found
- `502` — Azure service error

---

### 3. Chat

#### `POST /api/chat` — Send a message
Sends a message to a deployed agent and returns the response.

**Called from:** Builder Step 5 (Chat)

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

## UI ↔ API Mapping Summary

| UI Page / Step | API Calls | Notes |
|----------------|-----------|-------|
| Home | None | Static landing page |
| Skills — list | `GET /api/tools` | Grouped by type, shows param hints on cards |
| Skills — add | `POST /api/tools` | Full page form with parameter builder |
| Skills — edit | `PUT /api/tools/{id}` | Same form, pre-populated |
| Skills — delete | `DELETE /api/tools/{id}` | Confirmation dialog |
| Skills — health | `GET /api/tools/{id}/health` | Inline badge on skill card |
| Agents — list | `GET /api/agents` | Grid of deployed agents |
| Builder Step 1 | `GET /api/tools`, `GET /api/tools/{id}`, `GET /api/tools/{id}/health` | 3-panel: catalog, assigned, config |
| Builder Step 2 | None | Agent name, model, instructions |
| Builder Step 3 | None | Review summary (read-only) |
| Builder Step 4 | `POST /api/agents` | Deploy with spinner |
| Builder Step 5 | `POST /api/chat`, `GET /api/agents/{name}`, `DELETE /api/agents/{name}` | Chat playground |

---

## Notes for Frontend Development

1. **Terminology mapping** — UI says "Skills" everywhere. API endpoints use `/api/tools`. Do not rename the API — just map the labels in the frontend.

2. **Skill CRUD is on the Skills page, not the Builder** — The Builder Step 1 only allows drag-drop assignment and parameter configuration. Creating, editing, and deleting skills happens exclusively on the Skills page. Builder Step 1 includes a link: "Manage skills on the Skills page".

3. **Skill creation includes parameter definitions** — The "+ Add Custom Skill" form is a full page (not a modal) with sections: Basic Info, Connection Config, Deploy Parameters (builder), Runtime Parameters (builder). Each parameter has: key, label, type, options, default, required, description, placeholder.

4. **Markdown in chat responses** — `text` in chat responses may contain Markdown (headers, code blocks, lists, tables, bold, links). Render it with a Markdown library and sanitize for XSS.

5. **Tool parameter forms are data-driven** — The `deploy_params` and `runtime_params` in skill details contain UI metadata (`type`, `label`, `options`, `show_if`, etc.) that define how to render each form field. The frontend should dynamically generate forms from this metadata.

6. **Conditional field visibility** — Some fields have `show_if: { "other_key": "value" }`. Only show these fields when the referenced field matches the specified value.

7. **Builtin vs custom skills** — Skills with `source: "builtin"` are read-only (no edit/delete). Skills with `source: "custom"` support full CRUD. Builtin skills show a lock icon in the UI.

8. **Deploy params: metadata vs values** — `GET /api/tools/{id}` returns parameter **metadata** (label, type, options, defaults). `POST /api/agents` expects parameter **values** (flat key-value pairs). The frontend maps defaults + user overrides into the flat value format at deploy time.

9. **Agent versioning** — Deploying an agent with an existing name creates a new version (doesn't fail). The response contains the new version number. "Update Agent" in Step 5 restarts the builder to create a new version.

10. **Review step (Step 3) is client-side only** — No API calls. The frontend assembles and displays the full agent summary from local state before the user confirms deployment.

11. **Light/dark theme** — The UI supports light and dark themes with a toggle. Theme preference is stored in `localStorage`. The frontend should respect the user's choice.

12. **Chat-only mode** — Navigate to `/builder?agent={name}` to skip the wizard and go straight to chatting with an existing agent. This calls `GET /api/agents/{name}` to load agent details.

13. **Roles (coming soon)** — The Home page shows a "Roles" card marked "Coming Soon". No API endpoints exist for Roles yet. The nav link is disabled.
