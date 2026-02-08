# Azure AI Projects SDK Acceptance Criteria

**SDKs**: `azure-ai-projects` + `azure-ai-agents`
**Repository**: https://github.com/Azure/azure-sdk-for-python
**Purpose**: Skill testing acceptance criteria for validating generated code correctness

---

## 1. Correct Import Patterns

### 1.1 ✅ CORRECT: AIProjectClient Imports (Sync)
```python
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
```

### 1.2 ✅ CORRECT: AgentsClient Imports (Sync)
```python
from azure.ai.agents import AgentsClient
from azure.identity import DefaultAzureCredential
```

### 1.3 ✅ CORRECT: AIProjectClient Imports (Async)
```python
from azure.ai.projects.aio import AIProjectClient
from azure.identity.aio import DefaultAzureCredential
```

### 1.4 ✅ CORRECT: AgentsClient Imports (Async)
```python
from azure.ai.agents.aio import AgentsClient
from azure.identity.aio import DefaultAzureCredential
```

### 1.5 ✅ CORRECT: Project-Level Model Imports
```python
from azure.ai.projects.models import (
    # Agent definition models
    PromptAgentDefinition,
    AgentKind,
    # Connection models
    ConnectionType,
    # Deployment models
    ModelDeployment,
    # Evaluation models
    DataSourceConfigCustom,
    # Dataset/Index models
    DatasetVersion,
    AzureAISearchIndex,
    # Project-level tools (for versioned definitions)
    BingGroundingAgentTool,
    BingGroundingSearchToolParameters,
    BingGroundingSearchConfiguration,
    AzureAISearchAgentTool,
    AzureAISearchToolResource,
    AISearchIndexResource,
    AzureAISearchQueryType,
)
```

### 1.6 ✅ CORRECT: Runtime Tool Imports (from azure.ai.agents.models)
```python
from azure.ai.agents.models import (
    # Core tools
    CodeInterpreterTool,
    FileSearchTool,
    FunctionTool,
    ToolSet,
    # File handling
    FilePurpose,
    MessageAttachment,
    # Bing grounding (low-level)
    BingGroundingTool,
    # OpenAPI
    OpenApiTool,
    OpenApiAnonymousAuthDetails,
    # MCP
    McpTool,
    # Multi-agent
    ConnectedAgentTool,
    # Enterprise tools
    SharepointTool,
    FabricTool,
)
```

### 1.7 ✅ CORRECT: Streaming Handler Import
```python
# Sync handler
from azure.ai.agents.models import AgentEventHandler

# Async handler
from azure.ai.agents.aio import AsyncAgentEventHandler
```

### 1.8 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Importing from wrong module
```python
# WRONG - AIProjectClient is not in azure.ai.projects.models
from azure.ai.projects.models import AIProjectClient

# WRONG - tools are in azure.ai.agents.models, not azure.ai.projects
from azure.ai.projects import CodeInterpreterTool

# WRONG - PromptAgentDefinition is in azure.ai.projects.models
from azure.ai.agents.models import PromptAgentDefinition
```

#### ❌ INCORRECT: Using deprecated/non-existent classes
```python
# WRONG - AgentsClient is from azure.ai.agents, not azure.ai.projects
from azure.ai.projects import AgentsClient

# WRONG - These don't exist in azure.ai.projects.models
from azure.ai.projects.models import Agent, Thread, Message, Run
```

#### ❌ INCORRECT: Mixing async and sync imports
```python
# WRONG - mixing sync client with async credential
from azure.ai.agents import AgentsClient  # sync
from azure.identity.aio import DefaultAzureCredential  # async - wrong!
```

---

## 2. Client Creation Patterns

### 2.1 ✅ CORRECT: AgentsClient (Sync) with Context Manager
```python
from azure.ai.agents import AgentsClient
from azure.identity import DefaultAzureCredential
import os

agents_client = AgentsClient(
    endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
)

with agents_client:
    agent = agents_client.create_agent(...)
```

### 2.2 ✅ CORRECT: AIProjectClient (Sync) with Context Manager
```python
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
import os

project_client = AIProjectClient(
    endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
    credential=DefaultAzureCredential(),
)

with project_client:
    # Use for Foundry management only
    connections = project_client.connections.list()
    agent_def = project_client.agents.create_version(...)
```

### 2.3 ✅ CORRECT: Async AgentsClient with Context Manager
```python
import os
import asyncio
from azure.ai.agents.aio import AgentsClient
from azure.identity.aio import DefaultAzureCredential

async def main():
    async with (
        DefaultAzureCredential() as credential,
        AgentsClient(
            endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
            credential=credential,
        ) as agents_client,
    ):
        agent = await agents_client.create_agent(...)

asyncio.run(main())
```

### 2.4 ✅ CORRECT: Get OpenAI Client (AIProjectClient)
```python
# Get OpenAI-compatible client from project
openai_client = project_client.get_openai_client(
    api_version="2024-10-21",
)

# Use for chat completions
response = openai_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

### 2.5 ✅ CORRECT: Get OpenAI Client with Specific Connection
```python
openai_client = project_client.get_openai_client(
    api_version="2024-10-21",
    connection_name="my-aoai-connection",
)
```

### 2.6 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Wrong parameter names
```python
# WRONG - using 'url' instead of 'endpoint'
client = AgentsClient(url=endpoint, credential=cred)

# WRONG - using positional arguments
client = AgentsClient(endpoint, credential)  # Must use keyword args
```

#### ❌ INCORRECT: Not using context manager
```python
# WRONG - client should be used with context manager or explicitly closed
client = AgentsClient(endpoint=endpoint, credential=credential)
agent = client.create_agent(...)
# Missing: client.close() or using 'with' statement
```

#### ❌ INCORRECT: Using AIProjectClient for runtime operations
```python
# WRONG - AIProjectClient.agents does NOT have create_agent, threads, messages, runs
project_client = AIProjectClient(endpoint=endpoint, credential=credential)
with project_client:
    agent = project_client.agents.create_agent(...)  # Does not exist!
    thread = project_client.agents.threads.create()  # Does not exist!
```
Use `AgentsClient` from `azure.ai.agents` for runtime operations instead.

---

## 3. Agent Definition Operations (AIProjectClient)

### 3.1 ✅ CORRECT: Versioned Agent with PromptAgentDefinition
```python
from azure.ai.projects.models import PromptAgentDefinition

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
print(f"Agent: id={agent.id}, name={agent.name}, version={agent.version}")
```

### 3.2 ✅ CORRECT: Agent Definition with Tools (Versioned)
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

### 3.3 ✅ CORRECT: List Agents by Kind
```python
from azure.ai.projects.models import AgentKind

# Filter agents by kind
agents = project_client.agents.list(kind=AgentKind.PROMPT)
for agent in agents:
    print(f"Agent: {agent.name}")
```

### 3.4 ✅ CORRECT: Delete Agent Definition
```python
project_client.agents.delete(agent_name="my-agent")
```

### 3.5 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Using create_agent on AIProjectClient
```python
# WRONG - AIProjectClient.agents does NOT have create_agent()
agent = project_client.agents.create_agent(
    model="gpt-4o-mini",
    name="my-agent",
    instructions="Hello",
)
```
Use `project_client.agents.create_version()` for definitions, or `AgentsClient.create_agent()` for runtime.

---

## 4. Agent Runtime Operations (AgentsClient)

### 4.1 ✅ CORRECT: Create Agent
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

### 4.2 ✅ CORRECT: Agent with JSON Response Format
```python
agent = agents_client.create_agent(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    name="json-agent",
    instructions="Always respond in JSON format.",
    response_format={"type": "json_object"},
)
```

### 4.3 ✅ CORRECT: Agent with JSON Schema Response Format
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

### 4.4 ✅ CORRECT: Create Thread
```python
thread = agents_client.threads.create()
print(f"Created thread, ID: {thread.id}")
```

### 4.5 ✅ CORRECT: Create Thread with Tool Resources
```python
from azure.ai.agents.models import FileSearchTool

file_search = FileSearchTool(vector_store_ids=[vector_store.id])

thread = agents_client.threads.create(
    tool_resources=file_search.resources
)
```

### 4.6 ✅ CORRECT: Create Message
```python
message = agents_client.messages.create(
    thread_id=thread.id,
    role="user",
    content="What is the weather in Seattle?",
)
print(f"Created message, ID: {message.id}")
```

### 4.7 ✅ CORRECT: Create Message with Attachment
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

### 4.8 ✅ CORRECT: List Messages
```python
messages = agents_client.messages.list(thread_id=thread.id)
for msg in messages:
    print(f"Role: {msg.role}")
    for content in msg.content:
        if hasattr(content, 'text'):
            print(f"Content: {content.text.value}")
```

### 4.9 ✅ CORRECT: Get Last Message by Role
```python
response = agents_client.messages.get_last_message_text_by_role(
    thread_id=thread.id,
    role="assistant",
)
print(response)
```

### 4.10 ✅ CORRECT: Create and Process Run
```python
run = agents_client.runs.create_and_process(
    thread_id=thread.id,
    agent_id=agent.id,
)
print(f"Run finished with status: {run.status}")

if run.status == "failed":
    print(f"Run failed: {run.last_error}")
```

### 4.11 ✅ CORRECT: Create and Process Run with ToolSet
```python
from azure.ai.agents.models import FunctionTool, ToolSet

def get_weather(location: str) -> str:
    """Get weather for a location."""
    return f"Weather in {location}: 72F, sunny"

functions = FunctionTool(functions=[get_weather])
toolset = ToolSet()
toolset.add(functions)

# Enable auto function calls on AgentsClient
agents_client.enable_auto_function_calls(toolset)

run = agents_client.runs.create_and_process(
    thread_id=thread.id,
    agent_id=agent.id,
    toolset=toolset,  # Pass toolset for auto-execution
)
```

### 4.12 ✅ CORRECT: Streaming Run with Event Handler
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

### 4.13 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Wrong role value
```python
# WRONG - role must be "user" for messages from user
message = agents_client.messages.create(
    thread_id=thread.id,
    role="human",  # Wrong! Should be "user"
    content="Hello",
)
```

#### ❌ INCORRECT: Not checking run status
```python
# WRONG - not handling failed runs
run = agents_client.runs.create_and_process(
    thread_id=thread.id,
    agent_id=agent.id,
)
# Immediately accessing messages without checking status
```
Always check `run.status` before accessing results. If status is "failed", examine `run.last_error`.

#### ❌ INCORRECT: Using AIProjectClient for runtime
```python
# WRONG - these operations do NOT exist on AIProjectClient.agents
thread = project_client.agents.threads.create()  # Does not exist!
project_client.agents.messages.create(...)  # Does not exist!
project_client.agents.runs.create_and_process(...)  # Does not exist!
project_client.agents.enable_auto_function_calls(...)  # Does not exist!
```
Use `AgentsClient` from `azure.ai.agents` for all runtime operations.

---

## 5. Connections Operations (AIProjectClient)

### 5.1 ✅ CORRECT: List All Connections
```python
connections = project_client.connections.list()
for conn in connections:
    print(f"Name: {conn.name}")
    print(f"Type: {conn.connection_type}")
    print(f"ID: {conn.id}")
```

### 5.2 ✅ CORRECT: List Connections by Type
```python
from azure.ai.projects.models import ConnectionType

# List Azure OpenAI connections
for conn in project_client.connections.list(
    connection_type=ConnectionType.AZURE_OPEN_AI
):
    print(f"Azure OpenAI: {conn.name}")

# List Azure AI Search connections
for conn in project_client.connections.list(
    connection_type=ConnectionType.AZURE_AI_SEARCH
):
    print(f"AI Search: {conn.name}")
```

### 5.3 ✅ CORRECT: Get Connection by Name
```python
connection = project_client.connections.get(connection_name="my-search-connection")
print(f"Name: {connection.name}")
print(f"Type: {connection.connection_type}")
```

### 5.4 ✅ CORRECT: Get Connection with Credentials
```python
connection = project_client.connections.get(
    connection_name="my-search-connection",
    include_credentials=True,
)
print(f"Endpoint: {connection.endpoint_url}")
```

### 5.5 ✅ CORRECT: Get Default Connection
```python
from azure.ai.projects.models import ConnectionType

# Get default Azure OpenAI connection
default_aoai = project_client.connections.get_default(
    connection_type=ConnectionType.AZURE_OPEN_AI
)
print(f"Default Azure OpenAI: {default_aoai.name}")

# Get default with credentials
default_aoai = project_client.connections.get_default(
    connection_type=ConnectionType.AZURE_OPEN_AI,
    include_credentials=True,
)
```

### 5.6 ✅ CORRECT: Available ConnectionType Values
```python
from azure.ai.projects.models import ConnectionType

# Available connection types:
# - ConnectionType.AZURE_OPEN_AI
# - ConnectionType.AZURE_AI_SEARCH
# - ConnectionType.AZURE_BLOB
# - ConnectionType.AZURE_AI_SERVICES
# - ConnectionType.API_KEY
# - ConnectionType.COGNITIVE_SEARCH
# - ConnectionType.COGNITIVE_SERVICE
# - ConnectionType.CUSTOM
```

### 5.7 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Wrong ConnectionType values
```python
# WRONG - using string instead of enum
connections = project_client.connections.list(connection_type="AzureOpenAI")
```
Always use the `ConnectionType` enum from `azure.ai.projects.models`, not string values.

#### ❌ INCORRECT: Using wrong parameter name
```python
# WRONG - parameter is connection_name, not name
connection = project_client.connections.get(name="my-connection")
```
Use `connection_name` parameter instead of `name`.

---

## 6. Deployments Operations (AIProjectClient)

### 6.1 ✅ CORRECT: List All Deployments
```python
deployments = project_client.deployments.list()
for deployment in deployments:
    print(f"Name: {deployment.name}")
    print(f"Model: {deployment.model_name}")
    print(f"Publisher: {deployment.model_publisher}")
```

### 6.2 ✅ CORRECT: Filter Deployments by Publisher
```python
# List only OpenAI model deployments
for deployment in project_client.deployments.list(model_publisher="OpenAI"):
    print(f"{deployment.name}: {deployment.model_name}")
```

### 6.3 ✅ CORRECT: Filter Deployments by Model Name
```python
# List deployments of a specific model
for deployment in project_client.deployments.list(model_name="gpt-4o"):
    print(f"{deployment.name}: {deployment.model_version}")
```

### 6.4 ✅ CORRECT: Get Deployment
```python
from azure.ai.projects.models import ModelDeployment

deployment = project_client.deployments.get("my-deployment-name")

if isinstance(deployment, ModelDeployment):
    print(f"Type: {deployment.type}")
    print(f"Name: {deployment.name}")
    print(f"Model Name: {deployment.model_name}")
    print(f"Model Version: {deployment.model_version}")
    print(f"Model Publisher: {deployment.model_publisher}")
    print(f"Capabilities: {deployment.capabilities}")
```

### 6.5 ✅ CORRECT: Dynamic Model Selection for Runtime Agent
```python
# Find available GPT-4 deployments (AIProjectClient)
gpt4_deployments = [
    d for d in project_client.deployments.list()
    if "gpt-4" in d.model_name.lower()
]

if gpt4_deployments:
    deployment_name = gpt4_deployments[0].name

    # Use with AgentsClient for runtime
    agent = agents_client.create_agent(
        model=deployment_name,
        name="dynamic-agent",
        instructions="You are helpful.",
    )
```

### 6.6 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Wrong property access
```python
# WRONG - model property doesn't exist
deployment = project_client.deployments.get("my-deployment")
print(deployment.model)  # Wrong! Use model_name
```
Use `deployment.model_name` to access the model name.

---

## 7. OpenAI Client and Evaluations (AIProjectClient)

### 7.1 ✅ CORRECT: Get OpenAI Client
```python
openai_client = project_client.get_openai_client()
```

### 7.2 ✅ CORRECT: Define Data Source Configuration
```python
from azure.ai.projects.models import DataSourceConfigCustom

data_source_config = DataSourceConfigCustom(
    type="custom",
    item_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "expected_response": {"type": "string"},
        },
        "required": ["query"],
    },
    include_sample_schema=True,
)
```

### 7.3 ✅ CORRECT: Define Testing Criteria (Evaluators)
```python
testing_criteria = [
    {
        "type": "azure_ai_evaluator",
        "name": "violence_detection",
        "evaluator_name": "builtin.violence",
        "data_mapping": {
            "query": "{{item.query}}",
            "response": "{{item.response}}",
        },
    },
    {
        "type": "azure_ai_evaluator",
        "name": "fluency_check",
        "evaluator_name": "builtin.fluency",
        "data_mapping": {
            "query": "{{item.query}}",
            "response": "{{item.response}}",
        },
    },
]
```

### 7.4 ✅ CORRECT: Create Evaluation
```python
eval_object = openai_client.evals.create(
    name="Agent Quality Evaluation",
    data_source_config=data_source_config,
    testing_criteria=testing_criteria,
)
print(f"Created evaluation: {eval_object.id}")
```

### 7.5 ✅ CORRECT: Built-in Evaluators Reference
```python
# Available built-in evaluators:
# - builtin.violence: Detects violent content
# - builtin.fluency: Measures response fluency
# - builtin.task_adherence: Checks if response follows instructions
# - builtin.groundedness: Checks factual grounding
# - builtin.relevance: Measures response relevance
# - builtin.coherence: Checks logical coherence
# - builtin.similarity: Compares to expected response
```

### 7.6 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Creating evaluation on wrong client
```python
# WRONG - evals are on openai_client, not project_client
eval_object = project_client.evals.create(...)
```
Get the OpenAI client via `project_client.get_openai_client()` and call `evals.create()` on that.

#### ❌ INCORRECT: Wrong data_source_config type
```python
# WRONG - type must be "custom"
data_source_config = DataSourceConfigCustom(
    type="json",  # Wrong!
    item_schema={...},
)
```

---

## 8. Tools (AgentsClient)

### 8.1 ✅ CORRECT: CodeInterpreterTool
```python
from azure.ai.agents.models import CodeInterpreterTool

code_interpreter = CodeInterpreterTool()

agent = agents_client.create_agent(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    name="code-agent",
    instructions="You can execute Python code.",
    tools=code_interpreter.definitions,
    tool_resources=code_interpreter.resources,
)
```

### 8.2 ✅ CORRECT: FileSearchTool with Vector Store
```python
from azure.ai.agents.models import FileSearchTool, FilePurpose

# Upload and create vector store (AgentsClient)
file = agents_client.files.upload_and_poll(
    file_path="./data/product_info.md",
    purpose=FilePurpose.AGENTS,
)
vector_store = agents_client.vector_stores.create_and_poll(
    file_ids=[file.id],
    name="product-docs",
)

# Create file search tool
file_search = FileSearchTool(vector_store_ids=[vector_store.id])

agent = agents_client.create_agent(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    name="search-agent",
    instructions="Search uploaded files to answer questions.",
    tools=file_search.definitions,
    tool_resources=file_search.resources,
)
```

### 8.3 ✅ CORRECT: FunctionTool with ToolSet
```python
from azure.ai.agents.models import FunctionTool, ToolSet

def get_weather(location: str) -> str:
    """Get weather for a location."""
    return f"Weather in {location}: Sunny, 72F"

functions = FunctionTool(functions=[get_weather])
toolset = ToolSet()
toolset.add(functions)

# Enable auto function calls (AgentsClient)
agents_client.enable_auto_function_calls(toolset)

agent = agents_client.create_agent(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    name="auto-function-agent",
    instructions="Help with weather queries.",
    toolset=toolset,
)

# Process run - functions auto-execute
run = agents_client.runs.create_and_process(
    thread_id=thread.id,
    agent_id=agent.id,
    toolset=toolset,
)
```

### 8.4 ✅ CORRECT: BingGroundingTool (Low-Level, AgentsClient)
```python
from azure.ai.agents.models import BingGroundingTool

conn_id = os.environ["BING_CONNECTION_NAME"]
bing = BingGroundingTool(connection_id=conn_id)

agent = agents_client.create_agent(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    name="bing-agent",
    instructions="Use web search to find current information.",
    tools=bing.definitions,
)
```

### 8.5 ✅ CORRECT: BingGroundingAgentTool (Project-Level, AIProjectClient)
```python
from azure.ai.projects.models import (
    PromptAgentDefinition,
    BingGroundingAgentTool,
    BingGroundingSearchToolParameters,
    BingGroundingSearchConfiguration,
)

bing_connection = project_client.connections.get(
    os.environ["BING_PROJECT_CONNECTION_NAME"]
)

agent = project_client.agents.create_version(
    agent_name="bing-search-agent",
    definition=PromptAgentDefinition(
        model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
        instructions="You are a helpful assistant with web search capabilities.",
        tools=[
            BingGroundingAgentTool(
                bing_grounding=BingGroundingSearchToolParameters(
                    search_configurations=[
                        BingGroundingSearchConfiguration(
                            project_connection_id=bing_connection.id
                        )
                    ]
                )
            )
        ],
    ),
)
```

### 8.6 ✅ CORRECT: AzureAISearchAgentTool (Project-Level, AIProjectClient)
```python
from azure.ai.projects.models import (
    AzureAISearchAgentTool,
    AzureAISearchToolResource,
    AISearchIndexResource,
    AzureAISearchQueryType,
    PromptAgentDefinition,
)

search_connection = project_client.connections.get(
    os.environ["AI_SEARCH_PROJECT_CONNECTION_NAME"]
)

agent = project_client.agents.create_version(
    agent_name="enterprise-search-agent",
    definition=PromptAgentDefinition(
        model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
        instructions="You are a helpful assistant.",
        tools=[
            AzureAISearchAgentTool(
                azure_ai_search=AzureAISearchToolResource(
                    indexes=[
                        AISearchIndexResource(
                            project_connection_id=search_connection.id,
                            index_name=os.environ["AI_SEARCH_INDEX_NAME"],
                            query_type=AzureAISearchQueryType.SIMPLE,
                        ),
                    ]
                )
            )
        ],
    ),
)
```

### 8.7 ✅ CORRECT: OpenApiTool (AgentsClient)
```python
from azure.ai.agents.models import OpenApiTool, OpenApiAnonymousAuthDetails

openapi_tool = OpenApiTool(
    name="weather_api",
    spec="...",
    description="Get weather information",
    auth=OpenApiAnonymousAuthDetails(),
)

agent = agents_client.create_agent(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    name="api-agent",
    instructions="Use the weather API.",
    tools=openapi_tool.definitions,
)
```

### 8.8 ✅ CORRECT: McpTool (AgentsClient)
```python
from azure.ai.agents.models import McpTool

mcp_tool = McpTool(
    server_label="my-mcp-server",
    server_url="http://localhost:3000",
    allowed_tools=["search", "calculate"],
)

agent = agents_client.create_agent(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    name="mcp-agent",
    instructions="Use MCP tools for specialized operations.",
    tools=mcp_tool.definitions,
)
```

### 8.9 ✅ CORRECT: ConnectedAgentTool (AgentsClient)
```python
from azure.ai.agents.models import ConnectedAgentTool

connected_agent = ConnectedAgentTool(
    agent_id=other_agent.id,
    name="specialist-agent",
    description="A specialist agent for complex queries",
)

orchestrator = agents_client.create_agent(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    name="orchestrator",
    instructions="Delegate complex tasks to the specialist agent.",
    tools=connected_agent.definitions,
)
```

### 8.10 ✅ CORRECT: ToolSet with Multiple Tools
```python
from azure.ai.agents.models import ToolSet, FunctionTool, CodeInterpreterTool

def my_function(x: int) -> int:
    """Double a number."""
    return x * 2

toolset = ToolSet()
toolset.add(FunctionTool(functions=[my_function]))
toolset.add(CodeInterpreterTool())

# Enable auto function calls (AgentsClient)
agents_client.enable_auto_function_calls(toolset)

agent = agents_client.create_agent(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    name="multi-tool-agent",
    instructions="You have multiple tools available.",
    toolset=toolset,
)

# Pass toolset to run for auto-execution
run = agents_client.runs.create_and_process(
    thread_id=thread.id,
    agent_id=agent.id,
    toolset=toolset,
)
```

### 8.11 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Wrong tool import path
```python
# WRONG - CodeInterpreterTool is in azure.ai.agents.models
from azure.ai.projects.models import CodeInterpreterTool
```
Import tool classes from `azure.ai.agents.models`, not `azure.ai.projects.models`.

#### ❌ INCORRECT: Missing tool_resources for File Search
```python
# WRONG - FileSearchTool requires tool_resources to access vector stores
agent = agents_client.create_agent(
    model=model,
    name="search-agent",
    tools=file_search.definitions,
    # Missing: tool_resources=file_search.resources
)
```

#### ❌ INCORRECT: Passing FunctionTool object instead of definitions
```python
# WRONG - pass .definitions, not the tool object
functions = FunctionTool(functions=[my_func])
agent = agents_client.create_agent(
    model=model,
    tools=functions,  # Wrong! Should be functions.definitions
)
```

#### ❌ INCORRECT: Using enable_auto_function_calls on AIProjectClient
```python
# WRONG - enable_auto_function_calls is on AgentsClient, not AIProjectClient.agents
project_client.agents.enable_auto_function_calls(toolset)  # Does not exist!
```

---

## 9. Async Patterns

### 9.1 ✅ CORRECT: Async AgentsClient Setup
```python
import os
import asyncio
from azure.ai.agents.aio import AgentsClient
from azure.identity.aio import DefaultAzureCredential

async def main():
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
        await agents_client.delete_agent(agent.id)

asyncio.run(main())
```

### 9.2 ✅ CORRECT: Async Full Conversation Flow
```python
async with (
    DefaultAzureCredential() as credential,
    AgentsClient(
        endpoint=os.environ["AZURE_AI_PROJECT_ENDPOINT"],
        credential=credential,
    ) as agents_client,
):
    agent = await agents_client.create_agent(...)
    thread = await agents_client.threads.create()
    await agents_client.messages.create(
        thread_id=thread.id,
        role="user",
        content="What is the capital of Japan?",
    )
    run = await agents_client.runs.create_and_process(
        thread_id=thread.id,
        agent_id=agent.id,
    )
    if run.status == "completed":
        response = await agents_client.messages.get_last_message_text_by_role(
            thread_id=thread.id,
            role="assistant",
        )
        print(f"Response: {response}")
    await agents_client.delete_agent(agent.id)
```

### 9.3 ✅ CORRECT: Async Foundry Management (AIProjectClient)
```python
from azure.ai.projects.aio import AIProjectClient

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

### 9.4 ✅ CORRECT: Async Streaming with AsyncAgentEventHandler
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

### 9.5 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Using sync credential with async client
```python
# WRONG - using sync credential with async client
from azure.identity import DefaultAzureCredential  # This is SYNC!
async with AgentsClient(...) as agents_client:  # async client needs async credential
    ...
```

#### ❌ INCORRECT: Forgetting await
```python
# WRONG - missing await
async with AgentsClient(...) as agents_client:
    agent = agents_client.create_agent(...)  # Missing await!
```

#### ❌ INCORRECT: Using sync handler with async client
```python
# WRONG - use AsyncAgentEventHandler from azure.ai.agents.aio, not AgentEventHandler
```

---

## 10. Datasets and Indexes (AIProjectClient)

### 10.1 ✅ CORRECT: Upload Dataset File
```python
from azure.ai.projects.models import DatasetVersion

dataset = project_client.datasets.upload_file(
    name="my-dataset",
    version="1.0",
    file_path="./data/training_data.csv",
    connection_name="my-storage-connection",
)
print(f"Dataset uploaded: {dataset.name} v{dataset.version}")
```

### 10.2 ✅ CORRECT: Upload Dataset Folder
```python
import re
from azure.ai.projects.models import DatasetVersion

dataset = project_client.datasets.upload_folder(
    name="document-collection",
    version="2.0",
    folder="./data/documents/",
    connection_name="my-storage-connection",
    file_pattern=re.compile(r"\.(txt|csv|md|json)$", re.IGNORECASE),
)
print(f"Folder uploaded: {dataset.name} v{dataset.version}")
```

### 10.3 ✅ CORRECT: Get Dataset
```python
dataset = project_client.datasets.get(name="my-dataset", version="1.0")
```

### 10.4 ✅ CORRECT: List Datasets
```python
for dataset in project_client.datasets.list():
    print(f"{dataset.name}: {dataset.version}")
```

### 10.5 ✅ CORRECT: Delete Dataset
```python
project_client.datasets.delete(name="my-dataset", version="1.0")
```

### 10.6 ✅ CORRECT: Create or Update Index
```python
from azure.ai.projects.models import AzureAISearchIndex

index = project_client.indexes.create_or_update(
    name="my-index",
    version="1.0",
    index=AzureAISearchIndex(
        connection_name="my-ai-search-connection",
        index_name="products-index",
    ),
)
```

### 10.7 ✅ CORRECT: List Indexes
```python
for index in project_client.indexes.list():
    print(f"{index.name}: {index.version}")
```

### 10.8 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Missing version parameter
```python
# WRONG - version is required
dataset = project_client.datasets.upload_file(
    name="my-dataset",
    file_path="./data.csv",
    connection_name="storage",
)
```

#### ❌ INCORRECT: Using wrong parameter name for folders
```python
# WRONG - parameter is folder, not folder_path
dataset = project_client.datasets.upload_folder(
    name="docs",
    version="1.0",
    folder_path="./docs/",  # Wrong! Should be folder
    connection_name="storage",
)
```

---

## 11. File and Vector Store Operations (AgentsClient)

### 11.1 ✅ CORRECT: Upload File
```python
from azure.ai.agents.models import FilePurpose

file = agents_client.files.upload_and_poll(
    file_path="./data/document.pdf",
    purpose=FilePurpose.AGENTS,
)
print(f"Uploaded file, ID: {file.id}")
```

### 11.2 ✅ CORRECT: Create Vector Store
```python
vector_store = agents_client.vector_stores.create_and_poll(
    file_ids=[file.id],
    name="my-vector-store",
)
print(f"Created vector store, ID: {vector_store.id}")
```

### 11.3 ✅ CORRECT: File with Code Interpreter
```python
from azure.ai.agents.models import FilePurpose, CodeInterpreterTool

file = agents_client.files.upload_and_poll(
    file_path="data.csv",
    purpose=FilePurpose.AGENTS,
)

code_interpreter = CodeInterpreterTool()

agent = agents_client.create_agent(
    model=os.environ["AZURE_AI_MODEL_DEPLOYMENT_NAME"],
    name="data-agent",
    instructions="Analyze the data.",
    tools=code_interpreter.definitions,
    tool_resources={"code_interpreter": {"file_ids": [file.id]}},
)
```

### 11.4 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Wrong FilePurpose
```python
# WRONG - FilePurpose.ASSISTANTS doesn't exist
file = agents_client.files.upload_and_poll(
    file_path="doc.pdf",
    purpose=FilePurpose.ASSISTANTS,  # Wrong! Use FilePurpose.AGENTS
)
```

#### ❌ INCORRECT: Missing purpose parameter
```python
# WRONG - purpose is required
file = agents_client.files.upload_and_poll(
    file_path="doc.pdf",
)
```

---

## 12. Complete Example: Full Workflow

### 12.1 ✅ CORRECT: Complete Agent Workflow (using both clients)
```python
import os
from azure.ai.projects import AIProjectClient
from azure.ai.agents import AgentsClient
from azure.ai.agents.models import FunctionTool, ToolSet
from azure.identity import DefaultAzureCredential

endpoint = os.environ["AZURE_AI_PROJECT_ENDPOINT"]
model = os.environ.get("AZURE_AI_MODEL_DEPLOYMENT_NAME", "gpt-4o-mini")
credential = DefaultAzureCredential()

# --- Foundry management with AIProjectClient ---
with AIProjectClient(endpoint=endpoint, credential=credential) as project_client:
    # List deployments
    for d in project_client.deployments.list():
        print(f"Deployment: {d.name} ({d.model_name})")

# --- Agent runtime with AgentsClient ---
def get_weather(location: str) -> str:
    """Get weather for a location."""
    return f"Weather in {location}: 72F, sunny"

functions = FunctionTool(functions=[get_weather])
toolset = ToolSet()
toolset.add(functions)

with AgentsClient(endpoint=endpoint, credential=credential) as agents_client:
    agents_client.enable_auto_function_calls(toolset)

    agent = agents_client.create_agent(
        model=model,
        name="weather-assistant",
        instructions="You are a weather assistant. Use get_weather to look up weather.",
        toolset=toolset,
    )

    thread = agents_client.threads.create()

    agents_client.messages.create(
        thread_id=thread.id,
        role="user",
        content="What's the weather in Seattle?",
    )

    run = agents_client.runs.create_and_process(
        thread_id=thread.id,
        agent_id=agent.id,
        toolset=toolset,
    )

    if run.status == "completed":
        response = agents_client.messages.get_last_message_text_by_role(
            thread_id=thread.id,
            role="assistant",
        )
        print(f"Response: {response}")
    elif run.status == "failed":
        print(f"Run failed: {run.last_error}")

    # Clean up
    agents_client.delete_agent(agent.id)
```

---

## Quick Reference Tables

### Import Sources

| Import | Source |
|--------|--------|
| `AIProjectClient` | `azure.ai.projects` (sync) / `azure.ai.projects.aio` (async) |
| `AgentsClient` | `azure.ai.agents` (sync) / `azure.ai.agents.aio` (async) |
| `PromptAgentDefinition`, `ConnectionType`, `ModelDeployment`, `DataSourceConfigCustom` | `azure.ai.projects.models` |
| `BingGroundingAgentTool`, `AzureAISearchAgentTool` | `azure.ai.projects.models` |
| `CodeInterpreterTool`, `FileSearchTool`, `FunctionTool`, `ToolSet` | `azure.ai.agents.models` |
| `BingGroundingTool` (low-level), `OpenApiTool`, `McpTool` | `azure.ai.agents.models` |
| `AgentEventHandler` | `azure.ai.agents.models` (sync) / `azure.ai.agents.aio` (async) |
| `DefaultAzureCredential` | `azure.identity` (sync) / `azure.identity.aio` (async) |

### Client Access Patterns

| Operation | Client | Access Path |
|-----------|--------|-------------|
| Agent definitions (CRUD) | `AIProjectClient` | `project_client.agents.create_version()`, `.list()`, `.get()`, `.delete()` |
| Create live agent | `AgentsClient` | `agents_client.create_agent()` |
| Delete live agent | `AgentsClient` | `agents_client.delete_agent()` |
| Thread operations | `AgentsClient` | `agents_client.threads.create()`, `.list()`, `.get()` |
| Message operations | `AgentsClient` | `agents_client.messages.create()`, `.list()` |
| Run operations | `AgentsClient` | `agents_client.runs.create_and_process()`, `.stream()` |
| Auto function calls | `AgentsClient` | `agents_client.enable_auto_function_calls()` |
| File operations | `AgentsClient` | `agents_client.files.upload_and_poll()` |
| Vector store operations | `AgentsClient` | `agents_client.vector_stores.create_and_poll()` |
| Connection operations | `AIProjectClient` | `project_client.connections.list()`, `.get()` |
| Deployment operations | `AIProjectClient` | `project_client.deployments.list()`, `.get()` |
| Dataset operations | `AIProjectClient` | `project_client.datasets.upload_file()`, `.list()` |
| Index operations | `AIProjectClient` | `project_client.indexes.create_or_update()`, `.list()` |
| OpenAI client | `AIProjectClient` | `project_client.get_openai_client()` |
| Evaluations | OpenAI client | `openai_client.evals.create()`, `.runs.create()` |

### Key Differences: azure-ai-projects vs azure-ai-agents

| Aspect | `azure-ai-agents` (AgentsClient) | `azure-ai-projects` (AIProjectClient) |
|--------|----------------------------------|---------------------------------------|
| Package | `azure-ai-agents` | `azure-ai-projects` |
| Level | Agent runtime | Foundry management |
| Agent creation | `create_agent()` (live agents) | `agents.create_version()` (definitions) |
| Threads/Messages/Runs | `threads`, `messages`, `runs` | Not available |
| Tool execution | `enable_auto_function_calls()` | Not available |
| Streaming | `runs.stream()` | Not available |
| Connections | Not available | `connections.list()` / `.get()` |
| Deployments | Not available | `deployments.list()` / `.get()` |
| Datasets/Indexes | Not available | `datasets.*`, `indexes.*` |
| Evaluations | Not available | Via `get_openai_client()` |
| When to use | Run agents interactively | Define agents, manage Foundry resources |
