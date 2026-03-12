"""
ECHO V4 — Pydantic Response Models (backend/app/models/response_models.py)
Typed wrappers for all outbound payloads.
"""
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

class ChoiceMessage(BaseModel):
    role: str
    content: str

class Choice(BaseModel):
    index: int
    message: ChoiceMessage
    finish_reason: str = "stop"

class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    choices: List[Choice]
    weather_data: Optional[Dict[str, Any]] = None

class HealthResponse(BaseModel):
    status: str
    version: str
    mode: str
    resource_profile: str

class InsightResponse(BaseModel):
    status: str
    insight: Dict[str, Any]

class ErrorResponse(BaseModel):
    error: str
