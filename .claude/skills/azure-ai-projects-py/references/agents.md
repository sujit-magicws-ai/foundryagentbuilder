# Agent Operations Reference

This reference covers agent operations across two SDKs:
- **AIProjectClient** (`azure-ai-projects`) — Agent definition CRUD (versioning, listing)
- **AgentsClient** (`azure-ai-agents`) — Agent runtime (create, run, threads, messages)

## Agent Types and Kinds

```python
from azure.ai.projects.models import AgentKind

# Agent kinds
# - "prompt": Standard prompt-based agents
# - "hosted": Hosted agents
# - "container_app": Container App agents
# - "workflow": Workflow agents

# Filter agents by kind (AIProjectClient)
agents = project_client.agents.list(kind=AgentKind.PROMPT)
```

---

## Agent Definitions (AIProjectClient)

Use `AIProjectClient` for managing versioned agent definitions in Foundry.

### Versioned Agents with PromptAgentDefinition

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
            tools=[],  # Add tools as needed
        ),
        version_label="v1.0",
        description="Initial version",
    )
    print(f"Agent created (id: {agent.id}, name: {agent.name}, version: {agent.version})")
```

### Agent Definition with Tools

```python
from azure.ai.agents.models import CodeInterpreterTool, FileSearchTool
from azure.ai.projects.models import PromptAgentDefinition

agent = project_client.agents.create_version(
    agent_name="tool-agent",
    definition=PromptAgentDefinition(
        model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
        instructions="You can execute code and search files.",
        tools=[CodeInterpreterTool(), FileSearchTool()],
    ),
)
```

### List Agents

```python
from azure.ai.projects.models import AgentKind

# List all prompt agents
agents = project_client.agents.list(kind=AgentKind.PROMPT)
for agent in agents:
    print(f"Agent: {agent.name}")
```

### Delete Agent Definition

```python
project_client.agents.delete(agent_name="my-agent")
```

### Manage Versions

```python
# Create multiple versions
agent_v1 = project_client.agents.create_version(
    agent_name="my-agent",
    definition=PromptAgentDefinition(...),
    version_label="v1.0",
)

agent_v2 = project_client.agents.create_version(
    agent_name="my-agent",
    definition=PromptAgentDefinition(...),
    version_label="v2.0",
)
```

---

## Agent Runtime (AgentsClient)

Use `AgentsClient` from `azure-ai-agents` for creating and running agents interactively.

### Create Agent

```python
from azure.ai.agents import AgentsClient
from azure.identity import DefaultAzureCredential

with AgentsClient(
    endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
) as agents_client:
    agent = agents_client.create_agent(
        model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
        name="my-agent",
        instructions="You are a helpful assistant.",
    )
    print(f"Created agent, ID: {agent.id}")

    # Clean up when done
    agents_client.delete_agent(agent.id)
```

### Agent with Response Format

#### JSON Mode

```python
agent = agents_client.create_agent(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    name="json-agent",
    instructions="Always respond in JSON format.",
    response_format={"type": "json_object"},
)
```

#### JSON Schema

```python
agent = agents_client.create_agent(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    name="schema-agent",
    instructions="Respond with weather data.",
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "weather_response",
            "schema": {
                "type": "object",
                "properties": {
                    "temperature": {"type": "number"},
                    "conditions": {"type": "string"},
                    "humidity": {"type": "number"},
                },
                "required": ["temperature", "conditions"],
            },
        },
    },
)
```

## Thread Operations (AgentsClient)

### Create Thread

```python
thread = agents_client.threads.create()
print(f"Created thread, ID: {thread.id}")
```

### Create Thread with Tool Resources

```python
from azure.ai.agents.models import FileSearchTool

file_search = FileSearchTool(vector_store_ids=[vector_store.id])

thread = agents_client.threads.create(
    tool_resources=file_search.resources
)
```

### List Threads

```python
threads = agents_client.threads.list()
for thread in threads:
    print(f"Thread ID: {thread.id}")
```

## Message Operations (AgentsClient)

### Create Message

```python
message = agents_client.messages.create(
    thread_id=thread.id,
    role="user",
    content="What is the weather in Seattle?",
)
print(f"Created message, ID: {message.id}")
```

### Create Message with Attachment

```python
from azure.ai.agents.models import MessageAttachment, FileSearchTool

attachment = MessageAttachment(
    file_id=file.id,
    tools=FileSearchTool().definitions
)

message = agents_client.messages.create(
    thread_id=thread.id,
    role="user",
    content="What feature does Smart Eyewear offer?",
    attachments=[attachment],
)
```

### List Messages

```python
messages = agents_client.messages.list(thread_id=thread.id)
for msg in messages:
    print(f"Role: {msg.role}")
    for content in msg.content:
        if hasattr(content, 'text'):
            print(f"Content: {content.text.value}")
```

### Get Last Assistant Message

```python
response = agents_client.messages.get_last_message_text_by_role(
    thread_id=thread.id,
    role="assistant",
)
print(response)
```

## Run Operations (AgentsClient)

### Create and Process Run

```python
run = agents_client.runs.create_and_process(
    thread_id=thread.id,
    agent_id=agent.id,
)
print(f"Run finished with status: {run.status}")

if run.status == "failed":
    print(f"Run failed: {run.last_error}")
```

### Create and Process with ToolSet

```python
from azure.ai.agents.models import FunctionTool, ToolSet

def get_weather(location: str) -> str:
    """Get weather for a location."""
    return f"Weather in {location}: 72F, sunny"

functions = FunctionTool(functions=[get_weather])
toolset = ToolSet()
toolset.add(functions)

# Enable auto function calls
agents_client.enable_auto_function_calls(toolset)

run = agents_client.runs.create_and_process(
    thread_id=thread.id,
    agent_id=agent.id,
    toolset=toolset,  # Pass toolset for auto-execution
)
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

with agents_client.runs.stream(
    thread_id=thread.id,
    agent_id=agent.id,
    event_handler=MyHandler(),
) as stream:
    stream.until_done()
```

## Agent Lifecycle Best Practices

```python
from azure.ai.agents import AgentsClient
from azure.ai.agents.models import FunctionTool, ToolSet
from azure.identity import DefaultAzureCredential

# 1. Use context managers
with AgentsClient(
    endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
) as agents_client:
    agent = agents_client.create_agent(...)
    thread = agents_client.threads.create()

    # ... use agent ...

    # Clean up
    agents_client.delete_agent(agent.id)

# 2. Reuse threads for conversation continuity
thread_id = thread.id  # Save for later

# Resume conversation
agents_client.messages.create(
    thread_id=thread_id,
    role="user",
    content="Follow-up question",
)
```

## SDK Comparison for Agent Operations

| Operation | AIProjectClient | AgentsClient |
|-----------|----------------|--------------|
| Create agent definition | `project_client.agents.create_version(...)` | N/A |
| Create live agent | N/A | `agents_client.create_agent(...)` |
| Delete agent | `project_client.agents.delete(...)` | `agents_client.delete_agent(...)` |
| List agents | `project_client.agents.list(...)` | N/A |
| Threads | N/A | `agents_client.threads.*` |
| Messages | N/A | `agents_client.messages.*` |
| Runs | N/A | `agents_client.runs.*` |
| Streaming | N/A | `agents_client.runs.stream(...)` |
| Auto function calls | N/A | `agents_client.enable_auto_function_calls(...)` |
