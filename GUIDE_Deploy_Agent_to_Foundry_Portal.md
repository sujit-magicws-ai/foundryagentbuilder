# How to Build and Deploy an Agent Visible in Azure AI Foundry Portal

## The Key Insight

There are **two different SDKs** for creating agents in Azure AI Foundry. Only one of them makes the agent visible on the portal's Agents page.

| | Runtime Agent | Portal Definition |
|---|---|---|
| **SDK** | `azure-ai-agents` | `azure-ai-projects` |
| **Client** | `AgentsClient` | `AIProjectClient` |
| **Method** | `client.create_agent()` | `client.agents.create_version()` |
| **Visible in portal** | No | Yes |
| **Versioned** | No | Yes (v1, v2, v3...) |
| **Lifecycle** | Ephemeral (you manage create/delete) | Persistent (stays in portal) |
| **Example file** | `agent_runtime.py` | `agent_definition.py` |

## Agent Definition Types (Portal)

All portal-visible agents are created via `client.agents.create_version()` but with **different definition classes**:

```
AgentDefinition (base)
├── PromptAgentDefinition            (type: "prompt")
├── HostedAgentDefinition            (type: "hosted")
│   └── ImageBasedHostedAgentDefinition
├── ContainerAppAgentDefinition      (type: "container_app")
└── WorkflowAgentDefinition          (type: "workflow")
```

| | Prompt Agent | Hosted Agent |
|---|---|---|
| **Class** | `PromptAgentDefinition` | `ImageBasedHostedAgentDefinition` |
| **How it works** | Declarative: model + instructions + tools | Your code runs in a Docker container on Azure |
| **Key params** | `model`, `instructions`, `tools`, `temperature` | `image`, `cpu`, `memory`, `container_protocol_versions` |
| **Custom code** | No (but can call REST APIs via OpenApiTool) | Yes (any framework) |
| **Editable in portal** | Yes | No (code-only) |
| **Setup complexity** | Low (one SDK call) | Higher (Docker build, push to ACR, deploy) |
| **Supported frameworks** | N/A | Microsoft Agent Framework, LangGraph, custom |
| **Best for** | Simple single-agent scenarios | Complex production workflows with custom logic |

---

## Part 1: Prompt Agent (Simple, Declarative)

This is the quickest way to get an agent into the portal.

---

## Step-by-Step: Deploy a Prompt Agent to the Portal

### 1. Install Dependencies

```bash
pip install azure-ai-projects azure-identity python-dotenv
```

> Note: `azure-ai-projects` v2.0.0b3 is required. The older v1.x does NOT have `create_version()`.

### 2. Set Environment Variables

Create a `.env` file:

```
AZURE_AI_PROJECT_ENDPOINT=https://<your-resource>.services.ai.azure.com/api/projects/<your-project>
AZURE_AI_MODEL_DEPLOYMENT_NAME=gpt-4o-mini
```

You can find the endpoint in Azure AI Foundry portal under **Project settings**.

### 3. Create the Agent Definition

```python
import os
from dotenv import load_dotenv

load_dotenv()

from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import CodeInterpreterTool, PromptAgentDefinition
from azure.identity import DefaultAzureCredential

endpoint = os.environ["AZURE_AI_PROJECT_ENDPOINT"]
model = os.environ.get("AZURE_AI_MODEL_DEPLOYMENT_NAME", "gpt-4o-mini")

client = AIProjectClient(
    endpoint=endpoint,
    credential=DefaultAzureCredential(),
)

with client:
    agent = client.agents.create_version(
        agent_name="my-agent",
        definition=PromptAgentDefinition(
            model=model,
            instructions="You are a helpful assistant. Be concise.",
            tools=[CodeInterpreterTool()],
        ),
        description="My first portal-visible agent.",
    )

    print(f"Name   : {agent.name}")
    print(f"ID     : {agent.id}")
    print(f"Version: {agent.version}")
```

### 4. Verify in Portal

1. Go to [Azure AI Foundry](https://ai.azure.com)
2. Open your project
3. Click **Build** > **Agents**
4. Your agent should appear in the list with type **prompt**
5. Click it to open the playground and chat with it

---

## Key Concepts

### PromptAgentDefinition

This is the object that defines your agent. It contains:

| Parameter | Required | Description |
|---|---|---|
| `model` | Yes | Model deployment name (e.g. `gpt-4o-mini`) |
| `instructions` | No | System prompt — tells the agent how to behave |
| `tools` | No | List of tools the agent can use |
| `temperature` | No | Creativity (0 = deterministic, 2 = very random) |
| `top_p` | No | Nucleus sampling (alternative to temperature) |

### create_version()

| Parameter | Required | Description |
|---|---|---|
| `agent_name` | Yes | Name of the agent (also acts as identifier) |
| `definition` | Yes | Any `AgentDefinition` subclass (Prompt, Hosted, etc.) |
| `description` | No | Human-readable description shown in portal |
| `metadata` | No | Key-value pairs for tagging |

Calling `create_version()` on an **existing agent name** creates a **new version** (v2, v3, etc.) rather than overwriting.

---

## Tools: Server-Side vs Client-Side

The portal playground can execute tools that run **server-side** on Azure. Tools that require **client-side** execution will fail in the playground.

### Server-side tools (work in portal playground):

Azure makes the call — no client code needed.

| Tool | Import | Description |
|---|---|---|
| `CodeInterpreterTool` | `azure.ai.projects.models` | Runs Python code server-side (math, time, data analysis) |
| `BingGroundingTool` | `azure.ai.projects.models` | Web search via Bing (requires Bing connection) |
| `AzureAISearchTool` | `azure.ai.projects.models` | Search your own data indexes |
| `FileSearchTool` | `azure.ai.projects.models` | Search uploaded files |
| `OpenApiTool` | `azure.ai.agents.models` | **Call any REST API via OpenAPI spec** (Azure makes the HTTP call) |

### Client-side tools (FAIL in portal playground):

| Tool | Import | Description |
|---|---|---|
| `FunctionTool` | `azure.ai.projects.models` | JSON schema definition — portal returns `function_call` but cannot execute it |

To use FunctionTools with portal agents, you need a separate client script that:
1. Calls the agent via `project_client.get_openai_client().responses.create()`
2. Intercepts `function_call` items in the response
3. Executes the Python function locally
4. Sends results back via `function_call_output`

### OpenAPI Tool — Call External APIs from a Prompt Agent

This is a key capability: you do **not** need a Hosted agent just to call external APIs. A Prompt agent with an `OpenApiTool` can call any REST endpoint, and Azure handles the HTTP call server-side.

**How it works:**
1. You provide an OpenAPI 3.0+ spec (JSON/YAML) describing your API
2. The agent decides when to call the API based on user input
3. **Azure Foundry Service makes the HTTP request** to your API endpoint
4. The response comes back to the agent automatically
5. Works fully in the portal playground

**Authentication options:**

| Auth Type | Class | Use Case |
|---|---|---|
| Anonymous | `OpenApiAnonymousAuthDetails` | Public APIs, dev/testing |
| API Key | `OpenApiProjectConnectionAuthDetails` | Key stored in project connection |
| Managed Identity | `OpenApiManagedAuthDetails` | Enterprise (Azure AD) |

**Requirements:**
- OpenAPI 3.0+ spec
- Each operation must have an `operationId`
- Only `application/json` content type supported
- API must be reachable from Azure (use Azure Functions or App Service for internal APIs)

---

## Tool Scoping

Tools are **per-agent**, NOT per-project.

- There is no shared tool registry — each agent must define its own tools
- If you want the same OpenAPI tool on 3 agents, define it on all 3 individually
- Project **connections** (credentials) ARE shared — so auth config can be reused
- Tool override hierarchy: Agent level (broadest) > Thread level > Run level (narrowest)

---

## Part 2: Hosted Agent (Containerized, Code-Driven)

Use this when you need custom code execution — external API calls, LangGraph workflows, multi-agent orchestration, or any logic that can't be expressed with just a prompt and built-in tools.

### How It Works

1. You write your agent code using a supported framework
2. Package it into a Docker container
3. Push the image to Azure Container Registry (ACR)
4. Deploy via `create_version()` with `ImageBasedHostedAgentDefinition`
5. Azure manages the infrastructure (scaling, memory, observability)

### Supported Frameworks

| Framework | Language |
|---|---|
| Microsoft Agent Framework | Python, C# |
| LangGraph | Python |
| Custom code | Python, C# |

### ImageBasedHostedAgentDefinition Parameters

| Parameter | Required | Description |
|---|---|---|
| `image` | Yes | Container image URI (e.g. `myregistry.azurecr.io/myagent:latest`) |
| `cpu` | Yes | CPU allocation (e.g. `"1.0"`, `"2.0"`) |
| `memory` | Yes | Memory allocation (e.g. `"1Gi"`, `"2Gi"`) |
| `container_protocol_versions` | Yes | Communication protocols (list of `ProtocolVersionRecord`) |
| `tools` | No | Built-in tools the agent can use |
| `environment_variables` | No | Env vars passed to the container |
| `rai_config` | No | Content safety policy |

### Example: Deploy a Hosted Agent

```python
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import (
    ImageBasedHostedAgentDefinition,
    ProtocolVersionRecord,
    AgentProtocol,
)
from azure.identity import DefaultAzureCredential

client = AIProjectClient(
    endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
)

with client:
    agent = client.agents.create_version(
        agent_name="my-hosted-agent",
        definition=ImageBasedHostedAgentDefinition(
            container_protocol_versions=[
                ProtocolVersionRecord(
                    protocol=AgentProtocol.RESPONSES, version="v1"
                ),
            ],
            cpu="1",
            memory="2Gi",
            image="myregistry.azurecr.io/my-agent:latest",
            environment_variables={
                "AZURE_AI_PROJECT_ENDPOINT": "https://...",
                "MODEL_NAME": "gpt-4o-mini",
            },
        ),
        description="My hosted agent running custom code.",
    )
    print(f"Name   : {agent.name}")
    print(f"Version: {agent.version}")
```

### Running a Deployed Agent (Prompt or Hosted)

Both prompt and hosted agents are invoked the same way via the OpenAI Responses API:

```python
from azure.ai.projects.models import AgentReference

with client:
    openai_client = client.get_openai_client()
    response = openai_client.responses.create(
        input=[{"role": "user", "content": "Hello!"}],
        extra_body={
            "agent": AgentReference(name="my-agent", version="1").as_dict()
        },
    )
    print(response.output_text)
```

### Prompt vs Hosted — Quick Decision Guide

Choose **Prompt** if:
- Simple Q&A, content generation, or single-purpose assistant
- Built-in tools (CodeInterpreter, Bing, AI Search) are enough
- You need to call external REST APIs (use OpenApiTool — Azure calls them server-side)
- You want to edit the agent in the portal UI
- You want fast, zero-infrastructure setup

Choose **Hosted** if:
- You need custom Python/C# logic that can't be expressed as a REST API call
- You're using LangGraph or multi-agent frameworks
- You need full control over the runtime environment (custom libraries, ML models)
- You need production-grade scaling and observability

---

## Managing Agents via Code

### List all agents
```python
with client:
    agents = client.agents.list()
    for a in agents:
        print(f"{a.name} (version {a.version})")
```

### Get agent details
```python
with client:
    agent = client.agents.get(agent_name="my-agent")
    print(agent)
```

### Delete a specific version
```python
with client:
    client.agents.delete_version(agent_name="my-agent", agent_version=1)
```

### Delete an agent entirely (all versions)
```python
with client:
    client.agents.delete(agent_name="my-agent")
```

---

## Common Mistakes

| Mistake | Why it fails |
|---|---|
| Using `AgentsClient.create_agent()` | Creates a runtime agent, NOT visible in portal |
| Using `FunctionTool` with Python callables in a definition | `PromptAgentDefinition` expects JSON schema tools, not Python functions |
| Using custom `FunctionTool` and testing in portal playground | Portal has no handler for custom functions — use built-in tools instead |
| Using `azure-ai-projects` v1.x | v1.x does not have `agents.create_version()` — need v2.0.0b3+ |
| Confusing the two `FunctionTool` classes | `azure.ai.agents.models.FunctionTool` takes Python callables; `azure.ai.projects.models.FunctionTool` takes JSON schema (name, description, parameters) |

---

## Project Files

| File | Purpose |
|---|---|
| `agent_definition.py` | Deploys agent to portal using `AIProjectClient.agents.create_version()` |
| `agent_runtime.py` | Runs an ephemeral agent using `AgentsClient.create_agent()` (reference only) |
| `.env` | Environment variables (endpoint, model name) |
| `.agent_id` | Saved agent name from last deploy |
