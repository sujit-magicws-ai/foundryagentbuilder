"""Chat proxy API routes."""

from fastapi import APIRouter, Request

from chat import service
from chat.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
def chat(body: ChatRequest, request: Request):
    client = request.app.state.ai_client
    result = service.send_message(
        client,
        agent_name=body.agent_name,
        message=body.message,
        previous_response_id=body.previous_response_id,
    )
    return result
