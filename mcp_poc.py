"""
MCP Tool Proof of Concept — Deploy an agent with MCPTool to Azure AI Foundry portal.

This script validates that MCPTool works with PromptAgentDefinition, similar to the
OpenApiAgentTool PoC done with mock_apis. It uses the public Microsoft Learn MCP server
so the agent can search Microsoft documentation.

The agent is deployed to the Foundry portal and can be tested in the playground.

Usage:
    python mcp_poc.py

Prerequisites:
    pip install azure-ai-projects>=2.0.0b3 azure-identity python-dotenv

Environment Variables (set in .env file):
    AZURE_AI_PROJECT_ENDPOINT      - Your Azure AI Foundry project endpoint
    AZURE_AI_MODEL_DEPLOYMENT_NAME - Model deployment name (e.g. gpt-4o-mini)
"""

import os

from dotenv import load_dotenv

load_dotenv()

from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import CodeInterpreterTool, MCPTool, PromptAgentDefinition
from azure.identity import DefaultAzureCredential


def main():
    endpoint = os.environ["AZURE_AI_PROJECT_ENDPOINT"]
    model = os.environ.get("AZURE_AI_MODEL_DEPLOYMENT_NAME", "gpt-4o-mini")

    client = AIProjectClient(
        endpoint=endpoint,
        credential=DefaultAzureCredential(),
    )

    with client:
        agent = client.agents.create_version(
            agent_name="mcp-docs-agent",
            definition=PromptAgentDefinition(
                model=model,
                instructions=(
                    "You are a helpful technical assistant with access to Microsoft documentation.\n"
                    "Use the Microsoft Learn MCP tool to search for and read documentation.\n"
                    "When answering questions, cite the source documentation.\n"
                    "Use the code interpreter for calculations or data analysis.\n"
                    "Be concise and accurate."
                ),
                tools=[
                    MCPTool(
                        server_label="ms-learn",
                        server_url="https://learn.microsoft.com/api/mcp",
                        require_approval="never",
                    ),
                    CodeInterpreterTool(),
                ],
            ),
            description="Agent with MCP tool for searching Microsoft Learn documentation.",
        )

        print("MCP PoC agent deployed successfully!")
        print(f"  Name   : {agent.name}")
        print(f"  ID     : {agent.id}")
        print(f"  Version: {agent.version}")

    print("\nThe agent is now visible in the Azure AI Foundry portal.")
    print("Test it in the playground by asking:")
    print('  - "How do I create an Azure Function in Python?"')
    print('  - "What is Azure AI Foundry?"')
    print('  - "Explain Azure Managed Identity"')


if __name__ == "__main__":
    main()
