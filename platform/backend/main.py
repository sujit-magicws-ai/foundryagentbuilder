"""Agent Builder Platform — FastAPI application."""

import logging
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential

from config import get_settings
from exceptions import register_exception_handlers
from tools.service import load_catalog

from agents.router import router as agents_router
from chat.router import router as chat_router
from tools.router import router as tools_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

# Resolve frontend directory relative to this file
_FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup / shutdown lifecycle — creates AIProjectClient."""
    settings = get_settings()
    load_catalog()

    client = AIProjectClient(
        endpoint=settings.azure_ai_project_endpoint,
        credential=DefaultAzureCredential(),
    )
    app.state.ai_client = client
    logger.info("AIProjectClient initialised for %s", settings.azure_ai_project_endpoint)

    yield

    client.close()
    logger.info("AIProjectClient closed")


app = FastAPI(
    title="Agent Builder Platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
register_exception_handlers(app)

# API routers
app.include_router(tools_router)
app.include_router(agents_router)
app.include_router(chat_router)

# Serve frontend static files at root
app.mount("/", StaticFiles(directory=str(_FRONTEND_DIR), html=True), name="frontend")
