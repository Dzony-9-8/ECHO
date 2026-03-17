# ECHO — Multi-Agent AI Orchestration System

> Local AI powerhouse with a multi-agent swarm intelligence framework, hybrid RAG, real-time telemetry, and 30+ production-ready features.

![Version](https://img.shields.io/badge/version-3.5-brightgreen) ![Stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20React-blue) ![Models](https://img.shields.io/badge/models-Ollama%20Local-orange)

## Overview

ECHO is a full-stack AI assistant running entirely locally on your machine. Built on a multi-agent pipeline architecture where specialized AI agents collaborate to solve complex problems, ECHO delivers high-quality responses through parallel execution, self-reflection, and continuous self-improvement.

## Architecture

```
User → Planner → Supervisor → [Researcher | Developer] → Critic → Response
                     ↑___________feedback loop___________↑
```

**Stack:** FastAPI (Python 3.12) + Vite/React/TypeScript + Supabase Auth + ChromaDB + Ollama

## Features

### Core Multi-Agent Pipeline
- **Planner Agent** — Decomposes complex tasks into parallel subtasks
- **Supervisor Agent** — Coordinates agents, synthesizes results
- **Researcher Agent** — Deep analysis with thought graph exploration
- **Developer Agent** — Produces complete, working code (never stubs)
- **Critic Agent** — Multi-voter deliberation with accuracy/completeness/clarity judges

### Intelligence Features (v3.5)
| Feature | Description |
|---------|-------------|
| **Cognitive Architecture** | Think-before-respond loop with chain-of-thought planning |
| **Thought Graph System** | Multi-path reasoning — generates N approaches, Critic picks best |
| **Agent Personality Models** | Each agent has distinct personality traits baked into prompts |
| **Self-Improvement Engine** | Sentinel monitors performance, auto-tunes prompts and routing |
| **Speculative Decoding** | Draft with small model, refine with large — 2x faster for simple queries |

### Knowledge & Research
| Feature | Description |
|---------|-------------|
| **Hybrid RAG** | BM25 keyword + vector similarity (0.6×vector + 0.4×BM25) |
| **Auto Knowledge Ingestion** | File watcher on `/knowledge` folder — drop files to ingest |
| **Live Web Research** | DuckDuckGo search + trafilatura scraping with credibility scoring |
| **Deep Research** | Recursive depth/breadth research loop with gap analysis |
| **Memory System** | Episodic, semantic, procedural memory with decay scoring |

### AI Management (v3.5)
| Feature | Description |
|---------|-------------|
| **AI Project Mode** | Long-running project context management with task tracking |
| **Autonomous Tool Discovery** | Agents dynamically discover available tools at runtime |
| **AI Skill Compiler** | Compiles .md skill files into structured agent abilities |
| **Workflow Builder** | Visual no-code pipeline editor — custom agent sequences |

### Performance (v3.5)
| Feature | Description |
|---------|-------------|
| **Context Window Manager** | Adaptive context trimming per model's token limit |
| **Token Stream Batching** | Batches SSE tokens (4 at a time) to reduce overhead |
| **KV Cache Reuse** | `num_keep=256` keeps system prompt hot in Ollama's KV cache |
| **HTTP/2 Multiplexing** | Concurrent agent requests over single connection |
| **Model Quantization Switching** | Routes to 1b/3b/8b models based on task complexity |
| **Multi-GPU/Priority Scheduling** | VRAM-aware model loading with LRU eviction |
| **Response Streaming Pipeline** | Progressive agent results stream as each completes |
| **Response Cache** | LRU+TTL cache for repeated queries (200 entries, 1hr TTL) |

### Voice & Interaction
- **Voice STT** — faster-whisper tiny.en for speech-to-text
- **Voice TTS** — pyttsx3 SAPI5 text-to-speech
- **Slash Commands** — `/macro <name>` for prompt templates

### Analytics & Monitoring
- Real-time agent activity visualizer with token sparklines
- System telemetry (CPU/RAM/GPU/VRAM/Disk)
- Usage analytics dashboard
- Feedback system with automatic performance scoring

## Getting Started

### Prerequisites
- Python 3.12+
- Node.js 18+
- [Ollama](https://ollama.com) running on port 11434
- Supabase account (for auth)

### Install Models
```bash
ollama pull llama3.2:3b
ollama pull qwen2.5-coder:3b
ollama pull llama3.2:1b  # for speculative decoding
```

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup
```bash
npm install
npm run dev
# Opens at http://localhost:8080
```

### Environment Variables
Create `.env` in project root:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Main chat with full pipeline |
| `/api/agents` | GET | Real-time agent status |
| `/api/health` | GET | Backend health check |
| `/api/system` | GET | System metrics (CPU/RAM/GPU) |
| `/api/documents` | POST | Ingest document into RAG |
| `/api/semantic-search` | POST | Hybrid BM25+vector search |
| `/api/web-search` | POST | Live web search + scraping |
| `/api/deep-research` | POST | Recursive deep research |
| `/api/memory/store` | POST | Store a memory |
| `/api/memory/recall` | POST | Semantic memory recall |
| `/api/knowledge/status` | GET | Knowledge folder status |
| `/api/projects/create` | POST | Create AI project |
| `/api/projects` | GET | List all projects |
| `/api/tools/discover` | GET | List available tools |
| `/api/skills/compiled` | GET | Compiled skill abilities |
| `/api/sentinel/health` | GET | Routing health metrics |
| `/api/sentinel/improve` | POST | Trigger self-improvement |
| `/api/voice/transcribe` | POST | Speech-to-text |
| `/api/voice/speak` | POST | Text-to-speech |
| `/api/run-code` | POST | Safe Python execution |
| `/api/weather` | GET | Weather data |
| `/api/telemetry` | GET | Aggregated telemetry |

## Configuration

### Agent Models
Edit `AGENT_MODEL_MAP` in `backend/main.py`:
```python
AGENT_MODEL_MAP = {
    "Planner": "llama3.2:3b",
    "Supervisor": "llama3.2:3b",
    "Researcher": "llama3.2:3b",
    "Developer": "qwen2.5-coder:3b",
    "Critic": "llama3.2:3b",
    "default": "llama3.2:3b",
}
```

### Context Limits
```python
MODEL_CONTEXT_LIMITS = {
    "llama3.2:3b": 4096,
    "qwen2.5-coder:3b": 8192,
    "llama3.1:8b": 8192,
}
```

## Version History

| Version | Highlights |
|---------|-----------|
| **v3.5** | Cognitive Architecture, Thought Graph, Speculative Decoding, Project Mode, Tool Discovery, Skill Compiler, Self-Improvement Engine, Context Window Manager, KV Cache Reuse, HTTP/2, Stream Batching, Quantization Switching |
| **v3.4** | Memory Decay, Importance Scoring, Sentinel Engine, Critic Deliberation Voting, Voice STT/TTS |
| **v3.3** | trafilatura scraping, TTL search cache, Domain credibility scoring, Weather tool, Code interpreter, Deep Research loop |
| **v3.2** | Hybrid RAG (BM25+vector), Auto Knowledge Ingestion, Live Web Research, Conversation Tree, Real-time Agent Visualizer, Workflow Builder, Prompt Templates |
| **v3.1** | Multi-agent pipeline, ChromaDB RAG, Real telemetry, Feedback loop |

## License

MIT — built for local use and experimentation.
