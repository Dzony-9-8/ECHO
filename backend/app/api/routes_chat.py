"""
ECHO V4 — Chat Routes (backend/app/api/routes_chat.py)
Handles /v1/chat/completions and /v1/audio/transcriptions.
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from ..models.request_models import ChatCompletionRequest
from ..core.security import verify_api_key
from ..core.orchestrator import orchestrator

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.post("/chat/completions")
async def chat_completions(req: ChatCompletionRequest):
    request_data = {
        "model":            req.model,
        "messages":         [{"role": m.role, "content": m.content} for m in req.messages],
        "web_enabled":      req.web_enabled,
        "rag_enabled":      req.rag_enabled,
        "weather_enabled":  req.weather_enabled,
        "research_depth":   req.research_depth,
        "mode":             req.mode,
        "images":           req.images,
        "tools":            req.tools,
        "tool_choice":      req.tool_choice,
    }

    if req.stream:
        raise HTTPException(status_code=501, detail="Streaming not yet implemented. Send stream: false.")

    result = orchestrator.process_request(request_data)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.post("/audio/transcriptions")
async def create_transcription(file: UploadFile = File(...)):
    """Mock endpoint — prevents voice button crash until SpeechRecognition is ported."""
    return {"text": "[Voice transcription not yet implemented in V4]"}
