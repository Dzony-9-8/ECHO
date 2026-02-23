from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from ..core.orchestrator import orchestrator

router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: str = "llama3.1:8b"
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.7
    stream: Optional[bool] = False
    
    # Custom ECHO parameters overlaying OpenAI format
    web_enabled: Optional[bool] = False
    rag_enabled: Optional[bool] = False
    weather_enabled: Optional[bool] = False
    research_depth: Optional[int] = 0
    mode: Optional[str] = "chat"
    images: Optional[List[str]] = Field(default_factory=list)
    tools: Optional[list] = None
    tool_choice: Optional[str] = "auto"

@router.post("/v1/chat/completions")
async def chat_completions(req: ChatCompletionRequest):
    request_data = {
        "model": req.model,
        "messages": [{"role": m.role, "content": m.content} for m in req.messages],
        "web_enabled": req.web_enabled,
        "rag_enabled": req.rag_enabled,
        "weather_enabled": req.weather_enabled,
        "research_depth": req.research_depth,
        "mode": req.mode,
        "images": req.images,
        "tools": req.tools,
        "tool_choice": req.tool_choice
    }
    
    if req.stream:
        # In this first V2 implementation, we enforce non-streaming response due to orchestrator complexity,
        # but the JSON response follows OpenAI format exactly. We can wire the streaming generators later.
        raise HTTPException(status_code=501, detail="Streaming not fully implemented in V2 yet. Send stream: false.")
    
    result = orchestrator.process_request(request_data)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.get("/v1/insights/latest")
def get_latest_insight():
    # Return dummy data for frontend testing
    return {
        "status": "success",
        "insight": {
            "rag_matches": "Matched 2 chunks from offline vector db",
            "web_sources": "DuckDuckGo: 3 articles used",
            "research_rounds": 1,
            "branch_count": 0,
            "confidence_score": "High (0.89)"
        }
    }

@router.get("/v1/insights/session/{session_id}")
def get_session_insight(session_id: str):
    # Dummy setup, eventually ties into memory_engine metadata
    return get_latest_insight()

from fastapi import UploadFile, File
@router.post("/v1/audio/transcriptions")
async def create_transcription(file: UploadFile = File(...)):
    # Basic mock to prevent voice button from hard crashing until SpeechRecognition is ported
    return {"text": "[Voice Transcription Mock (Not yet ported to V2)]"}
