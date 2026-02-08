"""
Azure AI Agent — RUNTIME method (AgentsClient).

There are two ways to create agents in Azure AI Foundry:

  1. RUNTIME agents (this file)
     - SDK: azure-ai-agents → AgentsClient
     - Method: client.create_agent()
     - Ephemeral — agent exists for the session, deleted at the end
     - Supports custom Python function tools with auto-execution
     - Uses threads/messages/runs for multi-turn conversation
     - NOT visible in the Foundry portal Agents page

  2. PORTAL DEFINITIONS (see agent_definition.py)
     - SDK: azure-ai-projects → AIProjectClient
     - Method: client.agents.create_version() + PromptAgentDefinition
     - Persistent — versioned definition visible in the Foundry portal
     - Supports built-in tools (CodeInterpreter, Bing, AI Search)
     - Custom function tools require a separate client to handle calls

This file uses method 1 (RUNTIME). It creates an agent with CodeInterpreterTool,
runs a multi-turn chat, then deletes the agent.

Prerequisites:
    pip install azure-ai-agents azure-identity python-dotenv

Environment Variables (set in .env file):
    AZURE_AI_PROJECT_ENDPOINT      - Your Azure AI Foundry project endpoint
    AZURE_AI_MODEL_DEPLOYMENT_NAME - Model deployment name (e.g. gpt-4o-mini)
"""

import os

from dotenv import load_dotenv

load_dotenv()

from azure.ai.agents import AgentsClient
from azure.ai.agents.models import CodeInterpreterTool, ToolSet
from azure.identity import DefaultAzureCredential


# ---------------------------------------------------------------------------
# Helper to run a turn and print the response
# ---------------------------------------------------------------------------

def chat(client, agent, thread, user_message: str):
    """Send a message, run the agent, and print the response."""
    print(f"User: {user_message}")

    client.messages.create(
        thread_id=thread.id,
        role="user",
        content=user_message,
    )

    run = client.runs.create_and_process(
        thread_id=thread.id,
        agent_id=agent.id,
    )

    if run.status == "failed":
        print(f"Agent: [Run failed] {run.last_error}\n")
        return

    last_msg = client.messages.get_last_message_text_by_role(
        thread_id=thread.id,
        role="assistant",
    )
    print(f"Agent: {last_msg}\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    endpoint = os.environ["AZURE_AI_PROJECT_ENDPOINT"]
    model = os.environ.get("AZURE_AI_MODEL_DEPLOYMENT_NAME", "gpt-4o-mini")

    # 1. Build tools
    toolset = ToolSet()
    toolset.add(CodeInterpreterTool())

    # 2. Create client and agent
    client = AgentsClient(
        endpoint=endpoint,
        credential=DefaultAzureCredential(),
    )

    with client:
        agent = client.create_agent(
            model=model,
            name="weather-assistant",
            instructions=(
                "You are a helpful weather assistant. "
                "You have the following weather data:\n"
                "  Seattle: 55F, cloudy with light rain\n"
                "  New York: 68F, partly cloudy\n"
                "  London: 52F, overcast\n"
                "  Tokyo: 72F, sunny\n"
                "Use the code interpreter to run Python code when needed, "
                "for example to get the current time. "
                "Be concise in your responses."
            ),
            toolset=toolset,
        )
        print(f"Created agent: {agent.id}\n")

        # 3. Create a thread for conversation persistence
        thread = client.threads.create()

        # 4. Multi-turn conversation
        chat(client, agent, thread,
             "What's the weather like in Seattle and Tokyo?")

        chat(client, agent, thread,
             "Which of those cities is warmer?")

        chat(client, agent, thread,
             "What time is it in UTC right now?")

        # 5. Cleanup
        client.delete_agent(agent.id)
        print("Agent deleted. Done!")


if __name__ == "__main__":
    main()
