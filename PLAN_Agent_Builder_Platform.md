# Agent Builder Platform — Development Plan

## Vision

A web application where users browse a catalog of prebuilt API tools (OpenAPI specs + MCP servers), select the ones they want, configure their agent (name, instructions, model), and deploy it to Azure AI Foundry with one click.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Web UI (Builder)                          │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │ 1. Tool    │→ │ 2. Tool    │→ │ 3. Agent   │→ │ 4. Test   │  │
│  │ Catalog    │  │ Params     │  │ Config     │  │ Deploy    │  │
│  │ (browse,   │  │ (deploy +  │  │ (name,     │  │           │  │
│  │  select)   │  │  runtime)  │  │  model,    │  │           │  │
│  │            │  │            │  │  prompt)   │  │           │  │
│  └────────────┘  └────────────┘  └────────────┘  └─────┬─────┘  │
│                                                        │        │
│                                                        ▼        │
│                                                  ┌───────────┐  │
│                                                  │ 5. Chat   │  │
│                                                  │ Playground │  │
│                                                  └─────┬─────┘  │
│                                                        │        │
│        ┌───────────────────────────────────────────────┐│        │
│        │         Backend API (FastAPI)                 ││        │
│        │  /api/tools        — catalog + params         ││        │
│        │  /api/agents       — deploy / list / delete   │◄        │
│        │  /api/chat         — chat proxy               ││        │
│        │  /api/connections  — Azure project connections ││        │
│        └───────────────────┬───────────────────────────┘│        │
└─────────────────────────────┼────────────────────────────┘       │
                              ▼
          ┌───────────────────────────────┐
          │  Azure AI Foundry (Portal)    │
          │  AIProjectClient              │
          │  • create_version()           │
          │  • list() / get() / delete()  │
          │  • get_openai_client()        │
          │  • connections.list()         │
          └───────────────┬───────────────┘
                          ▼
          ┌──────────────────────────────────────┐
          │  Tool Servers (called by Azure)       │
          │  • OpenAPI endpoints (REST APIs)      │
          │  • MCP servers (MS Learn, GitHub...)  │
          │  • CodeInterpreter (Azure sandbox)    │
          └──────────────────────────────────────┘
```

## Tool Types Supported

| Type | How It Works | Maturity | Phase |
|------|-------------|----------|-------|
| **OpenApiAgentTool** | Azure calls REST API server-side using OpenAPI spec | GA (stable) | Phase 1-2 |
| **CodeInterpreterTool** | Runs Python server-side on Azure | GA (stable) | Phase 1-2 |
| **MCPTool** | Azure connects to MCP server, discovers and calls tools | Preview (VERIFIED) | Phase 1-2 |
| **BingGroundingAgentTool** | Web search via Bing (needs Bing connection) | GA | Phase 4 |
| **AzureAISearchAgentTool** | Search data indexes (needs AI Search resource) | GA | Phase 4 |

> **Note:** Both OpenAPI and MCP tools have been validated in PoCs. Both deploy via the same
> `PromptAgentDefinition(tools=[...])` → `create_version()` pattern. MCP shows a "Tools not
> configured" warning in the portal UI but works correctly at runtime.

---

## Phase 1: Tool PoCs — OpenAPI + MCP (DONE)

### Goal
Deploy mock APIs and validate that both OpenApiAgentTool and MCPTool work with PromptAgentDefinition.

### Deliverables
- [x] FastAPI mock API with 4 endpoints (weather, time, currency, jokes)
- [x] Deployed to Azure App Service: `https://foundryskill-mock-apis.azurewebsites.net`
- [x] OpenAPI 3.0.2 spec auto-generated (Azure rejects 3.1.0)
- [x] `mock-api-agent` deployed to portal with OpenApiAgentTool — verified working
- [x] Agent calls multiple API endpoints in a single turn
- [x] `mcp-docs-agent` deployed to portal with MCPTool (MS Learn) — verified working
- [x] MCP tool searches Microsoft docs and returns results in playground
- [x] Portal "Tools not configured" warning is non-blocking (UI-only)

### Test
- Open `mock-api-agent` in Foundry portal playground
  - Ask "What's the weather in Seattle and convert 100 USD to EUR"
  - Agent calls both APIs and returns results
- Open `mcp-docs-agent` in Foundry portal playground
  - Ask "What is Azure AI Foundry?"
  - Agent searches MS Learn docs and returns answer

---

## Phase 2: Backend API + Web UI + Chat Playground

### Goal
Build the web application with tool catalog, agent configuration, deploy-to-portal, and inline chat playground.

### Backend API (FastAPI)

```
GET  /api/tools                — list available tools from catalog
GET  /api/tools/{id}           — get tool details (params, spec)
POST /api/agents               — deploy agent (or update: same name → new version)
GET  /api/agents               — list deployed agents
GET  /api/agents/{name}        — get agent details (tools, params, version)
DELETE /api/agents/{name}      — delete agent from portal
POST /api/chat                 — chat with a deployed agent (proxy to Responses API)
GET  /api/connections          — list Azure project connections (for connection_picker, Phase 4)
```

> **Update flow**: `POST /api/agents` with an existing agent name calls `create_version()`
> again, which creates v2, v3, etc. No separate PUT endpoint needed.

### Tool Catalog (JSON)

Three tool types: `openapi`, `mcp`, and `builtin`. Each tool has two kinds of parameters:

- **`deploy_params`** — configure how the tool is wired up (URLs, auth, operations).
  Consumed by backend when building SDK tool objects at `create_version()` time.
- **`runtime_params`** — defaults, preferences, prompt variables.
  Injected into agent instructions so the LLM knows how to use the tools.

When a user selects a tool, the UI shows a parameter form with defaults pre-filled.
User adjusts values before deploying. Required params with no default must be filled in.

```json
{
  "tools": [
    {
      "id": "mock-weather",
      "name": "Weather API",
      "description": "Get current weather for any city",
      "type": "openapi",
      "category": "utilities",
      "icon": "cloud",
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
          "show_if": {"auth_type": "project_connection"},
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
    },
    {
      "id": "mock-currency",
      "name": "Currency Converter",
      "description": "Convert between currencies with live rates",
      "type": "openapi",
      "category": "utilities",
      "icon": "dollar",
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
          "options": ["convertCurrency"],
          "default": ["convertCurrency"],
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
          "show_if": {"auth_type": "project_connection"}
        }
      },
      "runtime_params": {
        "base_currency": {
          "label": "Default base currency",
          "type": "string",
          "default": "USD",
          "required": false,
          "inject_into": "instructions"
        }
      }
    },
    {
      "id": "ms-learn-docs",
      "name": "Microsoft Learn Docs",
      "description": "Search and read Microsoft documentation",
      "type": "mcp",
      "category": "knowledge",
      "icon": "book",
      "deploy_params": {
        "server_url": {
          "label": "MCP Server URL",
          "type": "string",
          "default": "https://learn.microsoft.com/api/mcp",
          "required": true
        },
        "require_approval": {
          "label": "Require approval for tool calls",
          "type": "select",
          "options": ["never", "always"],
          "default": "never",
          "required": true
        },
        "allowed_tools": {
          "label": "Restrict to specific tools (comma-separated, blank = all)",
          "type": "string",
          "default": "",
          "required": false
        }
      },
      "runtime_params": {
        "search_scope": {
          "label": "Documentation scope",
          "type": "select",
          "options": ["all", "azure", "dotnet", "python"],
          "default": "all",
          "required": false,
          "inject_into": "instructions"
        },
        "response_style": {
          "label": "Response style",
          "type": "select",
          "options": ["concise", "detailed", "step-by-step"],
          "default": "concise",
          "required": false,
          "inject_into": "instructions"
        }
      }
    },
    {
      "id": "gitmcp-repo",
      "name": "GitHub Repo Reader",
      "description": "Read and search any public GitHub repository",
      "type": "mcp",
      "category": "knowledge",
      "icon": "github",
      "deploy_params": {
        "owner": {
          "label": "Repository Owner",
          "type": "string",
          "default": "",
          "required": true,
          "placeholder": "e.g. microsoft"
        },
        "repo": {
          "label": "Repository Name",
          "type": "string",
          "default": "",
          "required": true,
          "placeholder": "e.g. azure-sdk-for-python"
        },
        "require_approval": {
          "label": "Require approval for tool calls",
          "type": "select",
          "options": ["never", "always"],
          "default": "never",
          "required": true
        }
      },
      "runtime_params": {
        "focus_area": {
          "label": "Focus area in repo",
          "type": "string",
          "default": "",
          "required": false,
          "placeholder": "e.g. src/authentication, README",
          "inject_into": "instructions"
        }
      }
    },
    {
      "id": "code-interpreter",
      "name": "Code Interpreter",
      "description": "Run Python code (math, data analysis, charts)",
      "type": "builtin",
      "category": "compute",
      "icon": "code",
      "deploy_params": {},
      "runtime_params": {
        "language_preference": {
          "label": "Preferred coding style",
          "type": "select",
          "options": ["python3", "pandas-heavy", "minimal"],
          "default": "python3",
          "required": false,
          "inject_into": "instructions"
        }
      }
    }
  ]
}
```

### Parameter UI Types

| Type | UI Element | Example |
|------|-----------|---------|
| `string` | Text input | Spec URL, repo owner |
| `password` | Masked text input | API keys (Phase 4) |
| `select` | Dropdown | Auth type, approval mode |
| `multi_select` | Checkbox list | Operations to include |
| `connection_picker` | Dropdown populated from `client.connections.list()` | Project connections |

### Conditional Display

`"show_if": {"auth_type": "project_connection"}` — field only appears when a specific
other param has a matching value. Used for auth fields that depend on auth_type selection.

### Authentication Strategy

Credentials are NEVER stored in our app. We use Azure Project Connections:

| Auth Method | How It Works | Phase |
|---|---|---|
| **Anonymous** | No auth needed | Phase 2 |
| **Project Connection** | API key or service principal stored in Azure, user picks from dropdown | Phase 4 |
| **Managed Identity** | System-assigned, no user config needed | Phase 4 |

Backend calls `client.connections.list()` to populate the connection picker dropdown.
User pre-creates connections in Azure portal (API key, service principal, etc.).

### Web UI Pages

1. **Tool Catalog** — browse tools by category/type, see descriptions, toggle selection
2. **Tool Parameter Config** — when a tool is selected, an inline panel expands showing:
   - **Deploy params** (top section): spec URL, auth type, connection picker, operations, etc.
   - **Runtime params** (bottom section): defaults, preferences, prompt variables
   - All fields pre-filled with defaults from catalog JSON
   - Required fields without defaults are highlighted (must be filled before deploy)
   - Conditional fields appear/hide based on `show_if` rules (e.g., connection picker only shows when auth = "project_connection")
   - User can collapse the panel after configuring (shows a summary badge: "3 params configured")
3. **Agent Config** — name, model, instructions, selected tools summary with param values
4. **Agent List** — see all deployed agents with status, edit/delete actions
5. **Chat Playground** — integrated into the build flow (not a separate page)

### User Flow

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│  1. Select   │ →  │  2. Configure│ →  │  3. Configure│ →  │  4. Test Deploy   │
│  Tools       │    │  Tool Params │    │  Agent       │    │  (create_version) │
│  (catalog    │    │  (deploy +   │    │  (name,      │    │                   │
│   browse)    │    │   runtime    │    │   model,     │    │  Agent is now     │
│              │    │   per tool)  │    │   prompt)    │    │  LIVE on portal   │
└──────────────┘    └──────────────┘    └──────────────┘    └────────┬──────────┘
                                                                     │
                                                                     ▼
                                                            ┌──────────────────┐
                                                            │  5. Chat         │
                                                            │  Playground      │
                                                            │  (test agent)    │
                                                            └────────┬─────────┘
                                                                     │
                                                        ┌────────────┼────────────┐
                                                        ▼            ▼            ▼
                                                  ┌──────────┐ ┌──────────┐ ┌──────────┐
                                                  │  Keep    │ │  Update  │ │  Delete  │
                                                  │  (done!) │ │  (go to  │ │  (remove │
                                                  │          │ │  step 1, │ │  from    │
                                                  │          │ │  v2/v3)  │ │  portal) │
                                                  └──────────┘ └──────────┘ └──────────┘
```

**Key insight**: Test Deploy IS the real deploy. `create_version()` is persistent — the agent
stays on the portal until explicitly deleted. No separate "publish" step needed.

- **Test Deploy** → `create_version()` → agent is live (v1)
- **Update** → user edits config → `create_version()` again → new version (v2, v3...)
- **Delete** → `delete(agent_name)` → removed from portal entirely

### Chat Playground Design

- Appears automatically after Test Deploy succeeds
- Chat input + message history
- Backend proxies via `project_client.get_openai_client().responses.create()`
- Shows tool call activity (which APIs/MCP servers the agent called)
- Supports multi-turn conversation (tracks `previous_response_id`)
- Action buttons: **Update Agent** (go back to config) | **Delete Agent** | **New Agent**

### Deploy Flow (Backend)

```
User selects tools → fills in deploy_params + runtime_params → configures agent → clicks Test Deploy
    ↓
Backend:
1. Reads selected tool configs + user-provided param values
2. For each tool, consume deploy_params to build SDK object:
   - openapi → fetch spec from deploy_params["spec_url"],
               filter to deploy_params["operations"],
               set auth from deploy_params["auth_type"] + optional connection_id,
               create OpenApiAgentTool(openapi=OpenApiFunctionDefinition(...))
   - mcp     → build server_url (direct or from template + deploy_params["owner"/"repo"]),
               create MCPTool(server_label=id, server_url=url,
                              require_approval=deploy_params["require_approval"],
                              allowed_tools=deploy_params.get("allowed_tools"))
   - builtin → create CodeInterpreterTool()
3. Consume runtime_params — inject into instructions:
   - For each param with inject_into="instructions" and a non-empty value,
     append context to the user's base instructions
   - Example: "For weather data, always report in celsius."
   - Example: "When searching docs, focus on azure documentation."
4. Calls AIProjectClient.agents.create_version(
       agent_name=user_name,
       definition=PromptAgentDefinition(
           model=selected_model,
           instructions=base_instructions + runtime_param_context,
           tools=[...assembled tools],
       )
   )
5. Returns agent name + version to frontend
6. Frontend transitions to Chat Playground with the deployed agent
```

### UI — Tool Type Badges

In the catalog, each tool shows a badge indicating its type:
- **API** badge (blue) — OpenAPI tools
- **MCP** badge (purple) — MCP server tools
- **Built-in** badge (green) — CodeInterpreter, etc.

Users can filter by type or browse all together. Selection works the same for all types.

### Test
1. **Tool selection** — browse catalog, select Weather API (OpenAPI) + MS Learn (MCP) + Code Interpreter
2. **Tool params** — for Weather API: verify defaults pre-filled (spec_url, auth=anonymous), change units to celsius. For MS Learn: set search_scope to "azure", response_style to "step-by-step"
3. **Agent config** — set name "test-agent", model "gpt-4o-mini", write instructions
4. **Test Deploy** — click button → agent deployed, Chat Playground opens
5. **Chat test** — ask "What's the weather in Seattle?" → uses OpenAPI tool, reports in celsius
6. **Chat test** — ask "How do I create an Azure Function?" → uses MCP tool, responds step-by-step
7. **Chat test** — ask "Calculate 15% tip on $85" → uses Code Interpreter
8. **Update flow** — click Update Agent → change instructions → redeploy as v2 → test again
9. **Verify** — agent visible in Foundry portal with correct version
10. **Delete flow** — click Delete → agent removed from portal

---

## Phase 3: Agent Templates + Tool Health Checks

### Goal
Add pre-configured agent templates for quick starts, and tool connectivity testing.

### Features

1. **Agent templates** — one-click starter agents:
   - "Research Assistant" = MS Learn MCP + Code Interpreter
   - "API Helper" = Weather + Currency + Code Interpreter
   - "Docs Explorer" = GitMCP (configurable repo) + Code Interpreter
   - Templates pre-fill tools, params, instructions, and model
   - User can customize any field before deploying

2. **Tool health check** — "Test" button next to each tool in catalog:
   - For OpenAPI: fetch spec URL → verify 200 response → validate spec is OpenAPI 3.0.x
   - For MCP: connect to server URL → verify MCP tool discovery responds
   - Shows green/red status badge in catalog
   - Helps users verify connectivity before deploying

### Test
- Click "Research Assistant" template → tools + params + instructions pre-filled → customize → deploy
- Click "Test" on Weather API → shows green status
- Click "Test" on a broken URL → shows red status with error message

---

## Phase 4: Auth via Project Connections, Polish, and Additional Tools

### Goal
Enable authenticated tools via Azure Project Connections (no raw secrets in our app),
add Bing/AI Search, and production polish.

### Authentication via Project Connections

Azure Project Connections securely store credentials. Our app never touches raw secrets.

**Supported connection types:**

| Connection Type | What's Stored in Azure | Use Case |
|---|---|---|
| API Key | key + endpoint | REST APIs requiring API key auth |
| Service Principal | client_id, client_secret, tenant_id | OAuth / AAD-protected APIs |
| Managed Identity | System-assigned (no secret) | Azure-to-Azure calls |

**How it works in our platform:**
1. User pre-creates connections in Azure AI Foundry portal (stores credentials securely)
2. Our backend calls `client.connections.list()` to get available connections
3. UI shows `connection_picker` dropdown when `auth_type` = `project_connection`
4. User selects a connection → backend passes `connection_id` to the SDK tool
5. At runtime, Azure resolves the connection and injects the credentials server-side

### Features

1. **Connection picker** — `connection_picker` UI type populated from `client.connections.list()`
2. **Authenticated OpenAPI tools** — `project_connection_id` passed to `OpenApiFunctionDefinition`
3. **Authenticated MCP servers** — `project_connection_id` or `headers` on `MCPTool`
4. **Bing Grounding** — `BingGroundingAgentTool` with Bing connection from project
5. **Azure AI Search** — `AzureAISearchAgentTool` with AI Search connection + index
6. **Agent versioning UI** — show version history, allow rollback
7. **Error handling** — graceful errors when deploy fails, tool unreachable, etc.

### Test
- Create an API Key connection in Azure portal
- In our UI, select an OpenAPI tool → set auth to "Project Connection" → pick the connection
- Deploy agent → verify authenticated API calls work
- Deploy agent with Bing + AI Search tools → verify in chat playground

---

## Phase 5: Multi-User + Custom Tools

### Goal
Allow users to add their own APIs/MCP servers to the catalog and share agents.

### Features

1. **Custom tool registration** — user provides:
   - For OpenAPI: URL to spec OR paste spec JSON + define deploy_params/runtime_params
   - For MCP: server URL + optional auth headers + define params
   - Platform validates spec/connectivity before adding to catalog
2. **Tool sharing** — public vs private tools in catalog
3. **Agent sharing** — share agent configs (tools, params, instructions) between users
4. **Usage analytics** — which tools/agents are most popular

### Test
- User registers their own FastAPI endpoint as a custom OpenAPI tool with params
- Creates agent with custom tool + catalog tools
- Shares agent config with another user

---

## Tech Stack (Proposed)

| Component | Technology |
|-----------|-----------|
| Frontend | React / Next.js (or simple HTML+JS for Phase 2 MVP) |
| Backend | FastAPI (Python) — same language as Azure SDK |
| Database | SQLite (Phase 2-3) → PostgreSQL (Phase 5) |
| Azure SDK | `azure-ai-projects>=2.0.0b3`, `azure-identity` |
| Deployment | Azure App Service (backend), Static Web Apps (frontend) |
| Auth | Azure AD / DefaultAzureCredential (Phase 4+) |

## File Structure (Planned)

```
FOUNDRYSKILL/
├── agent_definition.py          # Original reference script (Phase 1)
├── agent_runtime.py             # Original reference script (Phase 1)
├── mcp_poc.py                   # MCP tool PoC script (Phase 1)
├── mock_apis/                   # Phase 1 (DONE)
│   ├── main.py                  # FastAPI mock APIs
│   ├── requirements.txt
│   └── startup.txt
├── platform/                    # Phase 2+
│   ├── backend/
│   │   ├── main.py              # FastAPI app (API routes)
│   │   ├── tool_catalog.json    # Tool definitions with deploy_params + runtime_params
│   │   ├── services/
│   │   │   ├── agent_service.py # create_version, list, delete via AIProjectClient
│   │   │   ├── tool_service.py  # build SDK tool objects from catalog + user params
│   │   │   └── chat_service.py  # proxy chat via get_openai_client()
│   │   └── requirements.txt
│   └── frontend/
│       ├── index.html           # Landing page / agent list
│       ├── builder.html         # Steps 1-4: catalog → params → agent config → deploy
│       └── playground.html      # Step 5: chat with deployed agent
├── GUIDE_Deploy_Agent_to_Foundry_Portal.md
└── PLAN_Agent_Builder_Platform.md
```
