# ECHO Local Backend — Build Instructions

> **Target audience**: AI coding agents (Claude Code, Antigravity, Cursor, etc.)  
> **Target OS**: Windows 11  
> **Goal**: Build a fully functional local Python backend that replaces the cloud edge function, running local LLMs via Ollama and exposing the same API contract the ECHO frontend expects.

---

## 1. Architecture Overview

```
┌─────────────────────┐     HTTP (localhost:8000)     ┌──────────────────────┐
│   ECHO Frontend     │ ◄──────────────────────────► │   FastAPI Backend     │
│   (React/Vite)      │                               │   (Python 3.11+)     │
│                     │   POST /api/chat (SSE)        │                      │
│  localStorage:      │   GET  /api/health            │   ┌────────────────┐ │
│  echo_backend_mode  │   GET  /api/system            │   │  Ollama API    │ │
│  = "local"          │   GET  /api/agents            │   │  localhost:11434│ │
│                     │   POST /api/semantic-search   │   └────────────────┘ │
└─────────────────────┘                               └──────────────────────┘
```

The frontend has a **mode toggle** (Cloud / Local) in the System Panel sidebar. When set to **"Local"**, it sends all requests to `http://localhost:8000` (configurable via UI). The frontend code is in `src/lib/api.ts`.

---

## 2. API Contract

The frontend expects these exact endpoints. **Do not change the URL paths or response shapes.**

### 2.1 `GET /api/health`

Returns backend status. Frontend polls this every 10 seconds.

**Response (200 OK):**
```json
{
  "backend": "online",
  "gpu": {
    "name": "NVIDIA RTX 4090",
    "vram_used": 4200,
    "vram_total": 24576
  },
  "models_loaded": ["llama3.1:8b", "deepseek-r1:14b", "deepseek-coder-v2:16b"],
  "uptime": 3600
}
```

- `gpu` can be `null` if no GPU detected
- `models_loaded` should list currently loaded Ollama model tags
- `uptime` is seconds since server start

### 2.2 `GET /api/system`

Returns real-time system metrics. Frontend displays these in the Telemetry view.

**Response (200 OK):**
```json
{
  "cpu": {
    "name": "AMD Ryzen 9 7950X",
    "cores": 16,
    "threads": 32,
    "usage_percent": 12.5,
    "temperature_c": 55.0
  },
  "ram": {
    "total_gb": 64.0,
    "used_gb": 18.3,
    "usage_percent": 28.6
  },
  "gpu": {
    "name": "NVIDIA RTX 4090",
    "vram_total_mb": 24576,
    "vram_used_mb": 4200,
    "gpu_usage_percent": 35.0,
    "temperature_c": 62.0
  },
  "disk": {
    "total_gb": 2000.0,
    "used_gb": 850.0,
    "free_gb": 1150.0,
    "usage_percent": 42.5
  },
  "platform": "Windows",
  "hostname": "DESKTOP-ECHO"
}
```

- `gpu` can be `null`
- `temperature_c` can be `null` if sensors unavailable
- `disk` can be `null`

### 2.4 `GET /api/agents`

Returns real-time agent status. Frontend polls this every 5 seconds (local mode only).

**Response (200 OK):**
```json
{
  "agents": [
    {
      "name": "Supervisor",
      "status": "idle",
      "model": "llama3.1:8b",
      "currentTask": null,
      "lastActive": "2024-01-15T10:30:00Z",
      "tokensProcessed": 1250
    },
    {
      "name": "Researcher",
      "status": "active",
      "model": "deepseek-r1:14b",
      "currentTask": "Analyzing research papers on transformer architectures",
      "lastActive": "2024-01-15T10:31:00Z",
      "tokensProcessed": 3400
    },
    {
      "name": "Developer",
      "status": "idle",
      "model": "deepseek-coder-v2:16b",
      "currentTask": null,
      "lastActive": null,
      "tokensProcessed": 0
    },
    {
      "name": "Critic",
      "status": "idle",
      "model": "deepseek-r1:14b",
      "currentTask": null,
      "lastActive": null,
      "tokensProcessed": 0
    }
  ],
  "activeAgent": "Researcher",
  "pipeline": ["Supervisor", "Researcher", "Developer", "Critic"]
}
```

- `status`: one of `"idle"`, `"active"`, `"processing"`, `"complete"`, `"error"`
- `activeAgent`: name of the currently processing agent, or `null` if idle
- `pipeline`: ordered list showing the agent execution sequence
- `currentTask`: short description of what the agent is doing (shown in UI)
- Update agent status as requests flow through the multi-agent pipeline
- Track `tokensProcessed` per agent for analytics

**Implementation notes:**
```python
# Global state tracking
agent_states = {
    "Supervisor": {"status": "idle", "model": "llama3.1:8b", "currentTask": None, "lastActive": None, "tokensProcessed": 0},
    "Researcher": {"status": "idle", "model": "deepseek-r1:14b", "currentTask": None, "lastActive": None, "tokensProcessed": 0},
    "Developer": {"status": "idle", "model": "deepseek-coder-v2:16b", "currentTask": None, "lastActive": None, "tokensProcessed": 0},
    "Critic": {"status": "idle", "model": "deepseek-r1:14b", "currentTask": None, "lastActive": None, "tokensProcessed": 0},
}

@app.get("/api/agents")
async def get_agents():
    agents = []
    active = None
    for name, state in agent_states.items():
        agents.append({"name": name, **state})
        if state["status"] in ("active", "processing"):
            active = name
    return {
        "agents": agents,
        "activeAgent": active,
        "pipeline": list(agent_states.keys()),
    }
```

### 2.5 `POST /api/chat`

The core chat endpoint. **Must support SSE streaming.**

**Request body:**
```json
{
  "messages": [
    { "role": "system", "content": "You are ECHO..." },
    { "role": "user", "content": "Hello" }
  ],
  "model": "llama3.1:8b",
  "temperature": 0.7,
  "max_tokens": 2048,
  "depth": 1
}
```

**Fields:**
- `messages`: Array of `{role, content}` objects. Roles: `"system"`, `"user"`, `"assistant"`
- `model` (optional): Ollama model tag. Default to your best available model.
- `temperature` (optional): Float 0.0–2.0. Default 0.7.
- `max_tokens` (optional): Int 256–8192. Default 2048.
- `depth` (optional): Int 0–5. Critic self-review iterations (implement as extra system instructions).

**Response: Server-Sent Events (SSE) stream**

Content-Type: `text/event-stream`

The frontend parser (`src/lib/api.ts` lines 114–181) expects **OpenAI-compatible SSE format**:

```
data: {"choices":[{"delta":{"content":"Hello"}}]}

data: {"choices":[{"delta":{"content":" world"}}]}

data: [DONE]
```

Each `data:` line contains a JSON object with `choices[0].delta.content` holding the next token(s). The stream ends with `data: [DONE]`.

**CRITICAL**: The frontend's `parseSSEStream` function reads `parsed.choices?.[0]?.delta?.content`. You MUST use this exact structure. Ollama's native `/api/chat` returns `{"message":{"content":"..."}}` which is **NOT compatible** — you must transform it.

**Alternative non-streaming response** (fallback, if content-type is not `text/event-stream`):

```json
{
  "response": "Full response text here"
}
```

The frontend checks `response.headers.get("content-type")?.includes("text/event-stream")` to decide streaming vs JSON.

### 2.4 `POST /api/semantic-search` (optional, for RAG)

**Request body:**
```json
{
  "query": "search text",
  "user_id": "uuid",
  "limit": 5
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "title": "Document Title",
      "content": "Matched content...",
      "similarity": 0.85
    }
  ]
}
```

---

## 3. Tech Stack

| Component | Tool | Why |
|-----------|------|-----|
| Web framework | FastAPI | Already partially implemented in `backend/main.py` |
| AI inference | Ollama | Local LLM server, Windows-native, GPU-accelerated |
| Streaming | `sse-starlette` or raw `StreamingResponse` | SSE support |
| System metrics | `psutil`, `GPUtil` | Already in `backend/main.py` |
| Embeddings (RAG) | Ollama embeddings API | For semantic search |
| Vector store | ChromaDB or FAISS | For document similarity search |

---

## 4. Prerequisites — Install on Windows 11

### 4.1 Python
```powershell
# Install Python 3.11+ from python.org or:
winget install Python.Python.3.12
```

### 4.2 Ollama
```powershell
# Download and install Ollama for Windows from https://ollama.com/download/windows
# After install, pull models:
ollama pull llama3.1:8b
ollama pull deepseek-r1:14b
ollama pull deepseek-coder-v2:16b
```

Ollama runs on `http://localhost:11434` by default.

### 4.3 Python Dependencies
```powershell
cd backend
pip install fastapi uvicorn[standard] psutil GPUtil httpx sse-starlette
# Optional for RAG:
pip install chromadb sentence-transformers
```

---

## 5. Full Backend Implementation

Replace `backend/main.py` with the implementation below. This is the **complete** file.

```python
"""
ECHO Local Backend — FastAPI server with Ollama integration.

Run:
    cd backend
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import json
import time
import platform
import socket
from typing import Optional

import httpx
import psutil
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="ECHO Local Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

START_TIME = time.time()
OLLAMA_URL = "http://localhost:11434"

# ---------- Models ----------

AGENT_MODEL_MAP = {
    "Supervisor": "llama3.1:8b",
    "Researcher": "deepseek-r1:14b",
    "Developer": "deepseek-coder-v2:16b",
    "Critic": "deepseek-r1:14b",
    "default": "llama3.1:8b",
}

SYSTEM_PROMPT = """You are ECHO, an advanced AI orchestration system running locally. You are a multi-agent swarm intelligence framework with specialized agents:

- **Supervisor**: Coordinates tasks and delegates to specialists
- **Researcher**: Performs deep research with recursive analysis
- **Developer**: Generates code solutions and technical implementations
- **Critic**: Evaluates outputs for accuracy and detects hallucinations

You think step-by-step, provide detailed technical answers, and format responses with markdown. When coding, include complete working examples. When researching, cite reasoning chains.

You are running in LOCAL mode with full hardware access."""


# ---------- Pydantic Schemas ----------

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[Message]
    model: Optional[str] = None
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = 2048
    depth: Optional[int] = 1

class SearchRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    limit: Optional[int] = 5


# ---------- Helpers ----------

def get_gpu_info() -> dict | None:
    try:
        import GPUtil
        gpus = GPUtil.getGPUs()
        if not gpus:
            return None
        gpu = gpus[0]
        return {
            "name": gpu.name,
            "vram_total_mb": int(gpu.memoryTotal),
            "vram_used_mb": int(gpu.memoryUsed),
            "gpu_usage_percent": round(gpu.load * 100, 1),
            "temperature_c": gpu.temperature,
        }
    except Exception:
        return None


def get_cpu_temp() -> float | None:
    try:
        temps = psutil.sensors_temperatures()
        if not temps:
            return None
        for key in ("coretemp", "k10temp", "cpu_thermal"):
            if key in temps and temps[key]:
                return round(temps[key][0].current, 1)
        for sensors in temps.values():
            if sensors:
                return round(sensors[0].current, 1)
    except Exception:
        pass
    return None


def get_disk_info() -> dict | None:
    try:
        # Windows: use C: drive
        usage = psutil.disk_usage("C:\\")
        return {
            "total_gb": round(usage.total / (1024 ** 3), 1),
            "used_gb": round(usage.used / (1024 ** 3), 1),
            "free_gb": round(usage.free / (1024 ** 3), 1),
            "usage_percent": usage.percent,
        }
    except Exception:
        return None


async def get_loaded_models() -> list[str]:
    """Query Ollama for currently loaded models."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{OLLAMA_URL}/api/tags", timeout=3)
            if resp.status_code == 200:
                data = resp.json()
                return [m["name"] for m in data.get("models", [])]
    except Exception:
        pass
    return []


async def ollama_stream(
    model: str,
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 2048,
):
    """
    Stream from Ollama and yield OpenAI-compatible SSE chunks.
    
    Ollama returns: {"message": {"content": "token"}, "done": false}
    We transform to: data: {"choices": [{"delta": {"content": "token"}}]}
    """
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
        async with client.stream(
            "POST", f"{OLLAMA_URL}/api/chat", json=payload
        ) as response:
            if response.status_code != 200:
                error_text = await response.aread()
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Ollama error: {error_text.decode()}"
                )
            async for line in response.aiter_lines():
                if not line.strip():
                    continue
                try:
                    chunk = json.loads(line)
                    content = chunk.get("message", {}).get("content", "")
                    done = chunk.get("done", False)

                    if content:
                        # Transform to OpenAI-compatible SSE format
                        sse_data = {
                            "choices": [{"delta": {"content": content}}]
                        }
                        yield f"data: {json.dumps(sse_data)}\n\n"

                    if done:
                        yield "data: [DONE]\n\n"
                        return
                except json.JSONDecodeError:
                    continue


# ---------- Routes ----------

@app.get("/api/health")
async def health():
    gpu = get_gpu_info()
    models = await get_loaded_models()
    return {
        "backend": "online",
        "gpu": {
            "name": gpu["name"],
            "vram_used": gpu["vram_used_mb"],
            "vram_total": gpu["vram_total_mb"],
        } if gpu else None,
        "models_loaded": models,
        "uptime": round(time.time() - START_TIME),
    }


@app.get("/api/system")
def system_metrics():
    vm = psutil.virtual_memory()
    return {
        "cpu": {
            "name": platform.processor() or platform.machine(),
            "cores": psutil.cpu_count(logical=False) or psutil.cpu_count(),
            "threads": psutil.cpu_count(logical=True),
            "usage_percent": psutil.cpu_percent(interval=0.1),
            "temperature_c": get_cpu_temp(),
        },
        "ram": {
            "total_gb": round(vm.total / (1024 ** 3), 1),
            "used_gb": round(vm.used / (1024 ** 3), 1),
            "usage_percent": vm.percent,
        },
        "gpu": get_gpu_info(),
        "disk": get_disk_info(),
        "platform": platform.system(),
        "hostname": socket.gethostname(),
    }


@app.post("/api/chat")
async def chat(req: ChatRequest):
    """
    Main chat endpoint. Streams responses as SSE in OpenAI-compatible format.
    The ECHO frontend parses: choices[0].delta.content from each SSE event.
    """
    # Resolve model
    model = req.model or AGENT_MODEL_MAP.get("default", "llama3.1:8b")

    # Build messages with system prompt
    depth_instruction = ""
    if req.depth and req.depth > 0:
        depth_instruction = (
            f"\n\nCritic depth is set to {req.depth}. Before finalizing your response, "
            f"internally review your answer {req.depth} time(s) for accuracy, "
            f"hallucinations, and completeness. Correct any issues before responding."
        )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + depth_instruction}
    ]

    for msg in req.messages:
        # Skip the welcome message or system messages the frontend may inject
        if msg.role in ("user", "assistant", "system"):
            messages.append({"role": msg.role, "content": msg.content})

    return StreamingResponse(
        ollama_stream(
            model=model,
            messages=messages,
            temperature=req.temperature or 0.7,
            max_tokens=req.max_tokens or 2048,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/semantic-search")
async def semantic_search(req: SearchRequest):
    """
    Optional: semantic search over local documents.
    Uses Ollama's embedding endpoint for vector similarity.
    
    For a full implementation, integrate ChromaDB:
    1. pip install chromadb
    2. Store document embeddings in a ChromaDB collection
    3. Query with the embedded search query
    """
    # Placeholder — implement with ChromaDB when RAG is needed
    return {"results": []}


# ---------- Startup ----------

@app.on_event("startup")
async def startup():
    """Verify Ollama is running on startup."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{OLLAMA_URL}/api/tags", timeout=5)
            models = [m["name"] for m in resp.json().get("models", [])]
            print(f"✓ Ollama connected. Models available: {models}")
    except Exception:
        print("⚠ Ollama not detected at localhost:11434. Start Ollama first!")
        print("  Download: https://ollama.com/download/windows")
        print("  Then run: ollama pull llama3.1:8b")
```

---

## 6. Running the Backend

```powershell
# Terminal 1: Start Ollama (if not running as service)
ollama serve

# Terminal 2: Start the ECHO backend
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Then in the ECHO frontend:
1. Click the **System** panel on the right
2. Switch **Backend Mode** to **Local**
3. The status should show **CONNECTED** with your GPU info and loaded models

---

## 7. Frontend Integration Points

These are the exact code locations in the frontend that interact with the local backend. **Do not modify these files** — your backend must conform to their expectations.

| File | What it does |
|------|-------------|
| `src/lib/api.ts:7-9` | `getBackendUrl()` returns `localStorage.echo_backend_url` or `http://localhost:8000` |
| `src/lib/api.ts:17-19` | `getBackendMode()` returns `"cloud"` or `"local"` |
| `src/lib/api.ts:114-181` | `parseSSEStream()` — parses `choices[0].delta.content` from SSE |
| `src/lib/api.ts:218-251` | `sendLocalMessage()` — calls `POST {url}/api/chat`, handles SSE or JSON |
| `src/lib/api.ts:270-301` | `checkHealth()` — calls `GET {url}/api/health` |
| `src/lib/api.ts:98-112` | `fetchSystemMetrics()` — calls `GET {url}/api/system` |
| `src/components/SystemPanel.tsx` | Displays connection status, GPU, models, agents |

### SSE Parsing Logic (from `src/lib/api.ts`):

```typescript
// The frontend reads SSE like this:
const parsed = JSON.parse(jsonStr);
const content = parsed.choices?.[0]?.delta?.content;
// It accumulates content into fullText and calls onDelta(fullText)
```

**Your SSE lines MUST match**: `data: {"choices":[{"delta":{"content":"token"}}]}`

---

## 8. Recommended Models

| Agent | Recommended Model | VRAM Required | Ollama Tag |
|-------|-------------------|---------------|------------|
| Supervisor | LLaMA 3.1 8B | ~6 GB | `llama3.1:8b` |
| Researcher | DeepSeek R1 14B | ~10 GB | `deepseek-r1:14b` |
| Developer | DeepSeek Coder V2 | ~10 GB | `deepseek-coder-v2:16b` |
| Critic | DeepSeek R1 14B | (shared) | `deepseek-r1:14b` |
| Vision | LLaVA 1.6 | ~5 GB | `llava:13b` |
| Small/Fast | Phi-3 Mini | ~3 GB | `phi3:mini` |

**If you have < 8GB VRAM**, use smaller models:
```powershell
ollama pull llama3.2:3b
ollama pull deepseek-r1:7b
ollama pull deepseek-coder-v2:lite
```

---

## 9. Multi-Agent Routing (Advanced)

The frontend sends an `agent` field on messages. You can route to different Ollama models based on agent:

```python
AGENT_MODEL_MAP = {
    "Supervisor": "llama3.1:8b",
    "Researcher": "deepseek-r1:14b",
    "Developer": "deepseek-coder-v2:16b",
    "Critic": "deepseek-r1:14b",
    "default": "llama3.1:8b",
}
```

For true multi-agent orchestration, implement a pipeline:
1. **Supervisor** receives user message, decides which agent(s) to invoke
2. **Researcher** / **Developer** processes the task
3. **Critic** reviews the output (based on `depth` parameter)
4. Return the final reviewed response

---

## 10. RAG / Semantic Search (Advanced)

To enable the RAG panel in the frontend with local embeddings:

```powershell
pip install chromadb
ollama pull nomic-embed-text
```

```python
import chromadb
from chromadb.utils import embedding_functions

# Initialize ChromaDB with Ollama embeddings
ollama_ef = embedding_functions.OllamaEmbeddingFunction(
    url="http://localhost:11434",
    model_name="nomic-embed-text",
)

chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection(
    name="echo_documents",
    embedding_function=ollama_ef,
)

# Add documents
collection.add(
    documents=["document content here"],
    ids=["doc-uuid"],
    metadatas=[{"title": "Doc Title", "user_id": "user-uuid"}],
)

# Search
results = collection.query(query_texts=["search query"], n_results=5)
```

---

## 11. Project File Structure

```
backend/
├── main.py              # FastAPI server (the file you're building)
├── chroma_db/           # ChromaDB persistence (created automatically)
└── requirements.txt     # Python dependencies
```

### `backend/requirements.txt`
```
fastapi==0.115.0
uvicorn[standard]==0.32.0
psutil==6.1.0
GPUtil==1.4.0
httpx==0.28.0
sse-starlette==2.2.0
chromadb==0.5.0
```

---

## 12. Testing

### Quick smoke test:
```powershell
# Health check
curl http://localhost:8000/api/health

# System metrics
curl http://localhost:8000/api/system

# Chat (non-streaming test)
curl -X POST http://localhost:8000/api/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}"
```

### Verify SSE format:
```powershell
# You should see lines like:
# data: {"choices":[{"delta":{"content":"Hello"}}]}
# data: {"choices":[{"delta":{"content":" there"}}]}
# data: [DONE]
```

---

## 13. Troubleshooting

| Issue | Fix |
|-------|-----|
| "Ollama not detected" on startup | Run `ollama serve` or install Ollama as Windows service |
| CORS errors in browser | Already handled by `CORSMiddleware(allow_origins=["*"])` |
| Frontend shows "OFFLINE" | Ensure backend runs on port 8000, check frontend Backend URL setting |
| GPU not detected | Install NVIDIA drivers + CUDA toolkit, ensure `GPUtil` can find GPU |
| Slow responses | Use smaller models (`llama3.2:3b`), reduce `max_tokens` |
| SSE not working | Verify `Content-Type: text/event-stream` header and `data: ` prefix on each line |
| `psutil.sensors_temperatures()` empty on Windows | Normal — Windows doesn't expose CPU temps via psutil. `temperature_c` will be `null`. |

---

## 14. Agent Skills System

The frontend has an **Agent Skills** panel (`src/lib/agentSkills.ts`, `src/components/AgentSkillsPanel.tsx`) that allows users to upload `.md` skill files (e.g. from Claude Code) and assign them to specific agents.

### How it works:
- Skills are stored in `localStorage` under `echo_agent_skills`
- Each skill has: `name`, `content` (markdown), `agent` (Supervisor/Developer/Researcher/Critic/global), `enabled` flag
- When sending a chat message, the frontend calls `buildSkillsPrompt(agentName)` which concatenates all enabled skills for that agent into a system prompt section
- The skills are appended to the system prompt as: `## Agent Skills\n### Skill: <name>\n<content>`

### Backend integration:
When the local backend receives a `/api/chat` request, the system prompt will already contain the skills content — **no backend changes needed**. However, if you want the backend to manage skills server-side:

```python
# Optional: /api/skills endpoint for server-managed skills
@app.get("/api/skills")
async def get_skills():
    return {"skills": load_skills_from_disk()}

@app.post("/api/skills")
async def add_skill(skill: dict):
    save_skill_to_disk(skill)
    return {"status": "ok"}
```

### Skill file format:
Skills are standard `.md` files. The title is extracted from the first `# Heading` or the filename:
```markdown
# Code Review Expert
You are an expert code reviewer. When reviewing code:
1. Check for security vulnerabilities
2. Evaluate performance implications
3. Suggest cleaner patterns
...
```

---

## 15. Agent Metrics & Pipeline

The frontend tracks per-agent metrics in `localStorage` under `echo_agent_metrics`:
- `tokensProcessed`: cumulative tokens handled by each agent
- `totalResponseMs`: cumulative response time in ms
- `requestCount`: number of requests processed

The `/api/agents` endpoint should include these fields. The frontend also shows a **pipeline visualization** (`Supervisor → Researcher → Developer → Critic`) with progress indicators during active processing.

### Updated `/api/agents` response fields:
```json
{
  "agents": [
    {
      "name": "Supervisor",
      "status": "active",
      "model": "llama3.1:8b",
      "currentTask": "Routing user query",
      "lastActive": "2024-01-15T10:30:00Z",
      "tokensProcessed": 12500,
      "totalResponseMs": 45000,
      "requestCount": 15
    }
  ],
  "activeAgent": "Supervisor",
  "pipeline": ["Supervisor", "Researcher", "Developer", "Critic"]
}
```

The backend should update `tokensProcessed`, `totalResponseMs`, and `requestCount` as each agent handles requests in the multi-agent pipeline. The frontend displays:
- Per-agent: token count, avg response time, request count
- Session totals: aggregate tokens, requests, avg time
- Pipeline progress: visual dots showing which agent step is active

---

## Summary

1. Install Python 3.12 + Ollama + pull models
2. `pip install -r requirements.txt`
3. `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
4. Switch ECHO frontend to **Local** mode
5. Chat with local LLMs — zero cloud dependency
