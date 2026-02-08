# Async Patterns Reference

This reference covers async usage for both SDKs:
- **AgentsClient** (`azure.ai.agents.aio`) — Async agent runtime
- **AIProjectClient** (`azure.ai.projects.aio`) — Async Foundry management

## Async Agent Runtime (AgentsClient)

### Setup

```python
import os
import asyncio
from azure.ai.agents.aio import AgentsClient
from azure.identity.aio import DefaultAzureCredential

# Requires: pip install aiohttp

async def main():
    async with (
        DefaultAzureCredential() as credential,
        AgentsClient(
            endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
            credential=credential,
        ) as agents_client,
    ):
        # Use async agent operations
        pass

asyncio.run(main())
```

### Create Agent

```python
from azure.ai.agents.aio import AgentsClient
from azure.identity.aio import DefaultAzureCredential

async with (
    DefaultAzureCredential() as credential,
    AgentsClient(
        endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
        credential=credential,
    ) as agents_client,
):
    agent = await agents_client.create_agent(
        model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
        name="async-agent",
        instructions="You are helpful.",
    )
    print(f"Created agent: {agent.id}")

    # Clean up
    await agents_client.delete_agent(agent.id)
```

### Full Conversation Flow

```python
import os
import asyncio
from azure.ai.agents.aio import AgentsClient
from azure.identity.aio import DefaultAzureCredential

async def async_conversation():
    async with (
        DefaultAzureCredential() as credential,
        AgentsClient(
            endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
            credential=credential,
        ) as agents_client,
    ):
        # Create agent
        agent = await agents_client.create_agent(
            model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
            name="async-agent",
            instructions="You are a helpful assistant.",
        )

        # Create thread
        thread = await agents_client.threads.create()

        # Add message
        await agents_client.messages.create(
            thread_id=thread.id,
            role="user",
            content="What is the capital of Japan?",
        )

        # Create and process run
        run = await agents_client.runs.create_and_process(
            thread_id=thread.id,
            agent_id=agent.id,
        )

        # Get response
        if run.status == "completed":
            response = await agents_client.messages.get_last_message_text_by_role(
                thread_id=thread.id,
                role="assistant",
            )
            print(f"Response: {response}")
        elif run.status == "failed":
            print(f"Run failed: {run.last_error}")

        # Clean up
        await agents_client.delete_agent(agent.id)

asyncio.run(async_conversation())
```

### Async Streaming

```python
from azure.ai.agents.aio import AsyncAgentEventHandler

class AsyncHandler(AsyncAgentEventHandler):
    async def on_message_delta(self, delta):
        if delta.text:
            print(delta.text.value, end="", flush=True)

    async def on_error(self, data):
        print(f"Error: {data}")

async with AgentsClient(...) as agents_client:
    async with agents_client.runs.stream(
        thread_id=thread.id,
        agent_id=agent.id,
        event_handler=AsyncHandler(),
    ) as stream:
        await stream.until_done()
```

### Concurrent Operations

```python
import asyncio

async def process_multiple_queries(agents_client, agent_id, queries):
    """Process multiple queries concurrently."""

    async def process_query(query):
        thread = await agents_client.threads.create()
        await agents_client.messages.create(
            thread_id=thread.id,
            role="user",
            content=query,
        )
        run = await agents_client.runs.create_and_process(
            thread_id=thread.id,
            agent_id=agent_id,
        )
        if run.status == "completed":
            response = await agents_client.messages.get_last_message_text_by_role(
                thread_id=thread.id,
                role="assistant",
            )
            return response
        return None

    # Process all queries concurrently
    results = await asyncio.gather(*[process_query(q) for q in queries])
    return results

# Usage
async with AgentsClient(...) as agents_client:
    queries = [
        "What is Python?",
        "What is JavaScript?",
        "What is Rust?",
    ]
    results = await process_multiple_queries(agents_client, agent.id, queries)
    for query, result in zip(queries, results):
        print(f"Q: {query}")
        print(f"A: {result}\n")
```

### Error Handling

```python
from azure.core.exceptions import HttpResponseError

async with AgentsClient(...) as agents_client:
    try:
        agent = await agents_client.create_agent(...)
    except HttpResponseError as e:
        print(f"HTTP Error: {e.status_code}")
        print(f"Message: {e.message}")
    except Exception as e:
        print(f"Unexpected error: {e}")
```

---

## Async Foundry Management (AIProjectClient)

### Setup

```python
import os
import asyncio
from azure.ai.projects.aio import AIProjectClient
from azure.identity.aio import DefaultAzureCredential

async def main():
    async with (
        DefaultAzureCredential() as credential,
        AIProjectClient(
            endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
            credential=credential,
        ) as project_client,
    ):
        # Use async Foundry management operations
        pass

asyncio.run(main())
```

### Async Connections and Deployments

```python
async with AIProjectClient(...) as project_client:
    # List connections
    connections = project_client.connections.list()
    async for conn in connections:
        print(f"Connection: {conn.name}")

    # List deployments
    deployments = project_client.deployments.list()
    async for deployment in deployments:
        print(f"Deployment: {deployment.name}")
```

### Async Agent Definitions

```python
from azure.ai.projects.models import PromptAgentDefinition

async with AIProjectClient(...) as project_client:
    agent = await project_client.agents.create_version(
        agent_name="my-agent",
        definition=PromptAgentDefinition(
            model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
            instructions="You are helpful.",
            tools=[],
        ),
        version_label="v1.0",
    )
    print(f"Created agent definition: {agent.name} v{agent.version}")
```

### Async Memory Store Operations

```python
from azure.ai.projects.models import ItemParam, MemoryStoreUpdateCompletedResult
from azure.core.polling import AsyncLROPoller

async with AIProjectClient(...) as project_client:
    poller: AsyncLROPoller[MemoryStoreUpdateCompletedResult] = (
        await project_client.memory_stores.begin_update_memories(
            name="conversation-memory",
            scope="user123",
            items=[
                ItemParam(role="user", content="Hello!"),
                ItemParam(role="assistant", content="Hi there!"),
            ],
            previous_update_id=None,
            update_delay=300,
        )
    )
    result = await poller.result()
    print(f"Memory updated: {result}")
```

---

## Context Manager Best Practices

```python
# RECOMMENDED: Use nested context managers
async with (
    DefaultAzureCredential() as credential,
    AgentsClient(endpoint=endpoint, credential=credential) as agents_client,
):
    # Both credential and client are properly managed
    pass

# ALSO OK: Sequential context managers
async with DefaultAzureCredential() as credential:
    async with AgentsClient(endpoint=endpoint, credential=credential) as agents_client:
        pass

# AVOID: Manual resource management
agents_client = AgentsClient(endpoint=endpoint, credential=credential)
try:
    # ... operations
finally:
    await agents_client.close()  # Easy to forget
```

## Using Both Async Clients Together

```python
async with (
    DefaultAzureCredential() as credential,
    AIProjectClient(endpoint=endpoint, credential=credential) as project_client,
    AgentsClient(endpoint=endpoint, credential=credential) as agents_client,
):
    # Use project_client for Foundry management
    connections = project_client.connections.list()

    # Use agents_client for agent runtime
    agent = await agents_client.create_agent(...)
```
