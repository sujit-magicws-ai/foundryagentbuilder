"""
Azure AI Agent — DEFINITION method (AIProjectClient).

There are two ways to create agents in Azure AI Foundry:

  1. RUNTIME agents (see agent_runtime.py)
     - SDK: azure-ai-agents → AgentsClient
     - Method: client.create_agent()
     - Ephemeral — agent exists for the session, deleted at the end
     - Supports custom Python function tools with auto-execution
     - Uses threads/messages/runs for multi-turn conversation
     - NOT visible in the Foundry portal Agents page

  2. PORTAL DEFINITIONS (this file)
     - SDK: azure-ai-projects → AIProjectClient
     - Method: client.agents.create_version() + PromptAgentDefinition
     - Persistent — versioned definition visible in the Foundry portal
     - Supports built-in tools (CodeInterpreter, Bing, AI Search)
     - Custom function tools require a separate client to handle calls

This file uses method 2 (DEFINITION). It creates a versioned agent definition
with CodeInterpreterTool that appears on the Agents page in Azure AI Foundry.
The agent name/version is saved to .agent_id for reuse by other scripts.

Usage:
    python agent_definition.py

Prerequisites:
    pip install azure-ai-projects azure-identity python-dotenv

Environment Variables (set in .env file):
    AZURE_AI_PROJECT_ENDPOINT      - Your Azure AI Foundry project endpoint
    AZURE_AI_MODEL_DEPLOYMENT_NAME - Model deployment name (e.g. gpt-4o-mini)
"""

import os

from dotenv import load_dotenv

load_dotenv()

from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import CodeInterpreterTool, PromptAgentDefinition
from azure.identity import DefaultAzureCredential


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    endpoint = os.environ["AZURE_AI_PROJECT_ENDPOINT"]
    model = os.environ.get("AZURE_AI_MODEL_DEPLOYMENT_NAME", "gpt-4o-mini")

    client = AIProjectClient(
        endpoint=endpoint,
        credential=DefaultAzureCredential(),
    )

    with client:
        agent = client.agents.create_version(
            agent_name="weather-assistant",
            definition=PromptAgentDefinition(
                model=model,
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
                tools=[CodeInterpreterTool()],
            ),
            description="Weather and time assistant with function tools.",
        )

        print("Agent definition deployed successfully!")
        print(f"  Name   : {agent.name}")
        print(f"  ID     : {agent.id}")
        print(f"  Version: {agent.version}")

    # Save agent name for reuse
    agent_id_path = os.path.join(os.path.dirname(__file__), ".agent_id")
    with open(agent_id_path, "w") as f:
        f.write(agent.name)
    print(f"\nAgent name saved to {agent_id_path}")
    print("The agent is now visible in the Azure AI Foundry portal.")


if __name__ == "__main__":
    main()
