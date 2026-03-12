"""
ECHO V4 — Pydantic Request Models (backend/app/models/request_models.py)
Moved from openai_routes.py. Single source of truth for all inbound schemas.
"""
from pydantic import BaseModel, Field
from typing import List, Optional

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: str = "llama3.1:8b"
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.7
    stream: Optional[bool] = False

    # ECHO feature flags (OpenAI-extension fields)
    web_enabled:     Optional[bool] = False
    rag_enabled:     Optional[bool] = False
    weather_enabled: Optional[bool] = False
    research_depth:  Optional[int]  = 0
    mode:            Optional[str]  = "chat"
    images:          Optional[List[str]] = Field(default_factory=list)
    tools:           Optional[list] = None
    tool_choice:     Optional[str]  = "auto"
