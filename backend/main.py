from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from .emotional_assistant import EmotionalAssistant
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="ECHO AI Backend")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Components
# We use the EmotionalAssistant which encapsulates LLM, Memory, and Search
assistant = EmotionalAssistant(model_name="llama3.1:8b")

class ChatRequest(BaseModel):
    message: str
    username: Optional[str] = "User"
    session_id: Optional[str] = None
    images: Optional[List[str]] = None # Base64 encoded images

class ChatResponse(BaseModel):
    response: str
    emotion: str
    confidence: float
    session_id: str
    metadata: Optional[Dict[str, Any]] = None

class TruncateRequest(BaseModel):
    session_id: str
    index: int

@app.get("/")
def read_root():
    return {"status": "ECHO is online", "model": assistant.model_name}

from fastapi.responses import StreamingResponse
import json

@app.post("/chat")
def chat_endpoint(request: ChatRequest):
    print(f"DEBUG: Received chat request: {request.message[:50]}...")
    user_msg = request.message
    session_id = request.session_id
    
    # Check for empty message
    if not user_msg:
         return {"response": "I didn't quite catch that.", "emotion": "neutral", "confidence": 0.0, "session_id": session_id or assistant.session_id}

    async def generate_stream():
        print("DEBUG: Starting stream generation...")
        try:
            for chunk in assistant.generate_response(user_msg, user_session_id=session_id, stream=True, images=request.images):
                print(f"DEBUG: Yielding chunk: {chunk[:10]}...") 
                yield f"data: {json.dumps({'token': chunk})}\n\n"
            print("DEBUG: Stream finished.")
            yield "data: [DONE]\n\n"
        except Exception as e:
            print(f"DEBUG: Error in stream: {e}")
            yield f"data: {json.dumps({'token': f' [Error: {str(e)}]'})}\n\n"

    return StreamingResponse(generate_stream(), media_type="text/event-stream")

@app.post("/memory/clear")
def clear_memory(request: ChatRequest):
    # If a session_id is provided, we could conceptually clear just that.
    # For now, it resets the transient session in the assistant object.
    assistant.reset_session()
    return {"status": "Session reset", "new_session_id": assistant.session_id}

@app.post("/chat/truncate")
def truncate_endpoint(request: TruncateRequest):
    # Each row in DB is 2 messages (User + AI), so row_count = index // 2
    row_count_to_keep = request.index // 2
    count = assistant.truncate_conversation(request.session_id, row_count_to_keep)
    return {"status": "success", "deleted_count": count}

# --- CORE INTELLIGENCE ENDPOINTS (SPEC 1.0) ---

@app.post("/insights/generate")
def generate_insight_endpoint(request: ChatRequest):
    """Manually trigger insight generation for a session"""
    session_id = request.session_id or assistant.session_id
    insight = assistant.generate_session_insight(session_id)
    return {"status": "success", "insight": insight}

@app.get("/insights/session/{session_id}")
def get_session_insight_endpoint(session_id: str):
    """Get the latest insight for a specific session"""
    insight = assistant.memory.get_latest_insight(session_id)
    if not insight:
        return {"status": "no_insight_found", "insight": None}
    return {"status": "success", "insight": insight}

@app.get("/insights/latest")
def get_latest_insight_endpoint():
    """Returns the most recent insight for the current active session"""
    insight = assistant.memory.get_latest_insight(assistant.session_id)
    if not insight:
         return {"status": "no_insight_found", "insight": None}
    return {"status": "success", "insight": insight}

# --- VOICE TRANSCRIPTION ENDPOINT ---
import speech_recognition as sr
from fastapi import UploadFile, File
import shutil
import os

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Transcribe uploaded audio file using SpeechRecognition (Local).
    """
    temp_filename = f"temp_audio_{file.filename}"
    try:
        # Save temp file
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Transcribe
        recognizer = sr.Recognizer()
        with sr.AudioFile(temp_filename) as source:
            audio_data = recognizer.record(source)
            # Defaults to Google Speech Recognition (free tier, online but backend-mediated)
            # For pure offline: text = recognizer.recognize_sphinx(audio_data) (requires pocketsphinx)
            text = recognizer.recognize_google(audio_data)
            
        return {"text": text}
    except sr.UnknownValueError:
        return {"text": "", "error": "Could not understand audio"}
    except sr.RequestError as e:
        return {"text": "", "error": f"Speech API error: {e}"}
    except Exception as e:
        return {"text": "", "error": str(e)}
    finally:
        # Cleanup
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
