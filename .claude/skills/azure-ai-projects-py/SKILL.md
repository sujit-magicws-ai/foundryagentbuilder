---
name: azure-ai-projects-py
description: Build AI applications using the Azure AI Projects Python SDK (azure-ai-projects) and Azure AI Agents SDK (azure-ai-agents). Use when working with Foundry project clients for management (connections, deployments, datasets, indexes, evaluations), creating versioned agent definitions with PromptAgentDefinition, or running agents with AgentsClient (threads, messages, runs, tools). The two SDKs serve different purposes - azure-ai-projects for Foundry management, azure-ai-agents for agent runtime.
package: azure-ai-projects, azure-ai-agents
---

# Azure AI Projects & Agents Python SDK

Build AI applications on Microsoft Foundry using two complementary SDKs:

- **`azure-ai-projects`** — Foundry management: agent definitions, connections, deployments, datasets, indexes, evaluations
- **`azure-ai-agents`** — Agent runtime: create/run agents, threads, messages, runs, tools, streaming

## Installation

```bash
pip install azure-ai-projects>=2.0.0b3 azure-ai-agents azure-identity
```

## Environment Variables

```bash
AZURE_AI_PROJECT_ENDPOINT="https://<resource>.services.ai.azure.com/api/projects/<project>"
AZURE_AI_MODEL_DEPLOYMENT_NAME="gpt-4o-mini"
```

## Two SDKs, Two Clients

### AIProjectClient — Foundry Management

```python
import os
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

project_client = AIProjectClient(
    endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
)
```

**Operations available:**

| Operation | Access | Purpose |
|-----------|--------|---------|
| `project_client.agents` | `.create()`, `.create_version()`, `.get()`, `.list()`, `.delete()` | Agent definition CRUD |
| `project_client.connections` | `.list()`, `.get()`, `.get_default()` | List/get project connections |
| `project_client.deployments` | `.list()`, `.get()` | List model deployments |
| `project_client.datasets` | `.upload_file()`, `.upload_folder()`, `.list()`, `.get()`, `.delete()` | Dataset management |
| `project_client.indexes` | `.create_or_update()`, `.list()`, `.get()`, `.delete()` | Index management |
| `project_client.evaluators` | `.create_version()`, `.list_latest_versions()`, `.get_version()` | Evaluator management |
| `project_client.get_openai_client()` | Returns OpenAI client | Evaluations, chat completions |

### AgentsClient — Agent Runtime

```python
import os
from azure.identity import DefaultAzureCredential
from azure.ai.agents import AgentsClient

agents_client = AgentsClient(
    endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
)
```

**Operations available:**

| Operation | Access | Purpose |
|-----------|--------|---------|
| `agents_client.create_agent()` | Direct | Create agent with model, tools, instructions |
| `agents_client.threads` | `.create()`, `.get()`, `.list()`, `.delete()` | Thread management |
| `agents_client.messages` | `.create()`, `.list()`, `.get_last_message_text_by_role()` | Message management |
| `agents_client.runs` | `.create_and_process()`, `.stream()`, `.create()` | Run execution |
| `agents_client.enable_auto_function_calls()` | Direct | Auto-execute function tools |
| `agents_client.delete_agent()` | Direct | Delete agent |

## Agent Runtime (AgentsClient)

### Create Agent (Basic)

```python
from azure.ai.agents import AgentsClient
from azure.identity import DefaultAzureCredential

client = AgentsClient(
    endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
)

with client:
    agent = client.create_agent(
        model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
        name="my-agent",
        instructions="You are a helpful assistant.",
    )
```

### Create Agent with Function Tools

```python
from azure.ai.agents import AgentsClient
from azure.ai.agents.models import FunctionTool, ToolSet
from azure.identity import DefaultAzureCredential

def get_weather(location: str) -> str:
    """Get weather for a location."""
    return f"Weather in {location}: 72F, sunny"

functions = FunctionTool(functions=[get_weather])
toolset = ToolSet()
toolset.add(functions)

with AgentsClient(
    endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
) as client:
    client.enable_auto_function_calls(toolset)

    agent = client.create_agent(
        model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
        name="tool-agent",
        instructions="You can look up weather.",
        toolset=toolset,
    )
```

### Create Agent with Hosted Tools

```python
from azure.ai.agents import AgentsClient
from azure.ai.agents.models import CodeInterpreterTool, FileSearchTool
from azure.identity import DefaultAzureCredential

with AgentsClient(
    endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
) as client:
    code_interpreter = CodeInterpreterTool()

    agent = client.create_agent(
        model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
        name="code-agent",
        instructions="You can execute code and search files.",
        tools=code_interpreter.definitions,
        tool_resources=code_interpreter.resources,
    )
```

### Thread and Message Flow

```python
# 1. Create thread
thread = client.threads.create()

# 2. Add message
client.messages.create(
    thread_id=thread.id,
    role="user",
    content="What's the weather like?",
)

# 3. Create and process run (with auto tool execution via toolset)
run = client.runs.create_and_process(
    thread_id=thread.id,
    agent_id=agent.id,
    toolset=toolset,
)

# 4. Get response
if run.status == "completed":
    response = client.messages.get_last_message_text_by_role(
        thread_id=thread.id,
        role="assistant",
    )
    print(response)
elif run.status == "failed":
    print(f"Run failed: {run.last_error}")
```

### Streaming Run

```python
from azure.ai.agents.models import AgentEventHandler

class MyHandler(AgentEventHandler):
    def on_message_delta(self, delta):
        if delta.text:
            print(delta.text.value, end="", flush=True)

    def on_error(self, data):
        print(f"Error: {data}")

with client.runs.stream(
    thread_id=thread.id,
    agent_id=agent.id,
    event_handler=MyHandler(),
    toolset=toolset,
) as stream:
    stream.until_done()
```

## Agent Definitions (AIProjectClient)

### Versioned Agents with PromptAgentDefinition

For production deployments, create versioned agent definitions:

```python
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import PromptAgentDefinition
from azure.identity import DefaultAzureCredential

with AIProjectClient(
    endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
) as project_client:
    agent = project_client.agents.create_version(
        agent_name="customer-support-agent",
        definition=PromptAgentDefinition(
            model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
            instructions="You are a customer support specialist.",
            tools=[],
        ),
        version_label="v1.0",
    )
    print(f"Agent: name={agent.name}, version={agent.version}")
```

### OpenAI-Compatible Client

```python
openai_client = project_client.get_openai_client()

response = openai_client.chat.completions.create(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    messages=[{"role": "user", "content": "Hello!"}],
)
```

## Connections

```python
connections = project_client.connections.list()
for conn in connections:
    print(f"{conn.name}: {conn.connection_type}")

connection = project_client.connections.get(connection_name="my-search-connection")
```

See [references/connections.md](references/connections.md) for connection patterns.

## Deployments

```python
deployments = project_client.deployments.list()
for deployment in deployments:
    print(f"{deployment.name}: {deployment.model_name}")
```

See [references/deployments.md](references/deployments.md) for deployment patterns.

## Datasets and Indexes

```python
datasets = project_client.datasets.list()
indexes = project_client.indexes.list()
```

See [references/datasets-indexes.md](references/datasets-indexes.md) for data operations.

## Evaluation

```python
openai_client = project_client.get_openai_client()

eval_object = openai_client.evals.create(
    name="quality-check",
    data_source_config=data_source_config,
    testing_criteria=testing_criteria,
)
```

See [references/evaluation.md](references/evaluation.md) for evaluation patterns.

## Async Clients

```python
# Async agent runtime
from azure.ai.agents.aio import AgentsClient
from azure.identity.aio import DefaultAzureCredential

async with (
    DefaultAzureCredential() as credential,
    AgentsClient(endpoint=endpoint, credential=credential) as client,
):
    agent = await client.create_agent(...)

# Async project management
from azure.ai.projects.aio import AIProjectClient

async with AIProjectClient(
    endpoint=endpoint, credential=credential,
) as project_client:
    connections = project_client.connections.list()
```

See [references/async-patterns.md](references/async-patterns.md) for async patterns.

## Tools Overview

| Tool | Class | Import From | Use Case |
|------|-------|-------------|----------|
| Code Interpreter | `CodeInterpreterTool` | `azure.ai.agents.models` | Execute Python, generate files |
| File Search | `FileSearchTool` | `azure.ai.agents.models` | RAG over uploaded documents |
| Function Calling | `FunctionTool` | `azure.ai.agents.models` | Call your Python functions |
| Bing Grounding | `BingGroundingTool` | `azure.ai.agents.models` | Web search (requires connection) |
| Azure AI Search | `AzureAISearchAgentTool` | `azure.ai.projects.models` | Search your indexes |
| OpenAPI | `OpenApiTool` | `azure.ai.agents.models` | Call REST APIs |
| MCP | `McpTool` | `azure.ai.agents.models` | Model Context Protocol servers |
| Connected Agent | `ConnectedAgentTool` | `azure.ai.agents.models` | Multi-agent orchestration |
| SharePoint | `SharepointTool` | `azure.ai.agents.models` | Search SharePoint content |

See [references/tools.md](references/tools.md) for all tool patterns.

## SDK Comparison

| Feature | `azure-ai-projects` (AIProjectClient) | `azure-ai-agents` (AgentsClient) |
|---------|----------------------------------------|----------------------------------|
| Level | Foundry management | Agent runtime |
| Agent creation | `agents.create()` / `agents.create_version()` (definitions) | `create_agent()` (live agents) |
| Threads/Messages/Runs | Not available | `threads`, `messages`, `runs` |
| Tool execution | Not available | `enable_auto_function_calls()` |
| Streaming | Not available | `runs.stream()` |
| Connections | `connections.list()` / `.get()` | Not available |
| Deployments | `deployments.list()` / `.get()` | Not available |
| Datasets/Indexes | `datasets.*`, `indexes.*` | Not available |
| Evaluations | Via `get_openai_client()` | Not available |
| When to use | Define agents, manage Foundry resources | Run agents interactively |

## Best Practices

1. **Use `AgentsClient`** for running agents (threads, messages, runs, tools)
2. **Use `AIProjectClient`** for managing Foundry resources (connections, deployments, evaluations)
3. **Use context managers** for both clients: `with client:` or `async with client:`
4. **Clean up agents** when done: `client.delete_agent(agent.id)`
5. **Use `create_and_process`** for simple runs, **streaming** for real-time UX
6. **Use versioned agents** (`create_version()` on project client) for production deployments

## Reference Files

- [references/agents.md](references/agents.md): Agent operations (AgentsClient runtime + AIProjectClient definitions)
- [references/tools.md](references/tools.md): All agent tools with examples
- [references/evaluation.md](references/evaluation.md): Evaluation operations overview
- [references/built-in-evaluators.md](references/built-in-evaluators.md): Complete built-in evaluator reference
- [references/custom-evaluators.md](references/custom-evaluators.md): Code and prompt-based evaluator patterns
- [references/connections.md](references/connections.md): Connection operations
- [references/deployments.md](references/deployments.md): Deployment enumeration
- [references/datasets-indexes.md](references/datasets-indexes.md): Dataset and index operations
- [references/async-patterns.md](references/async-patterns.md): Async client usage
- [references/api-reference.md](references/api-reference.md): Complete API reference
- [scripts/run_batch_evaluation.py](scripts/run_batch_evaluation.py): CLI tool for batch evaluations
