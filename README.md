# Project ECHO

**ECHO** is a modern, modular, self-optimizing Multi-Agent AI Platform built with Python (FastAPI) and a React (Vite + Tailwind CSS) frontend. It orchestrates a swarm of specialized LLM agents (Supervisor, Developer, Researcher, Critic) that collaborate autonomously to solve complex tasks, powered by a hybrid embedding memory system.

## 🚀 Architecture Overview

ECHO is composed of two primary systems:

1. **AI Orchestrator (Backend)**
   - **Language:** Python 3.10+
   - **Framework:** FastAPI
   - **Core Engine:** Swarm Protocol (AgentManager, Supervisor, Critic, Specialists)
   - **Memory:** Hybrid system combining FAISS (vector similarity) and SQLite (structured metadata).
   - **Models:** Supports both local inference (via GGUF/llama-cpp-python) and cloud endpoints (Ollama / VLLM compatible).

2. **Multi-Agent Hub (Frontend)**
   - **Language:** JavaScript
   - **Framework:** React + Vite
   - **Styling:** Tailwind CSS v4
   - **UI Paradigm:** Multi-Agent Grid tracking parallel thought processes, confidence scores, citations, and semantic memory highlights in real-time.

---

## 🧠 The Multi-Agent Swarm

When a user submits a query to ECHO, it isn't simply passed to an LLM. It goes through a rigorous, self-correcting swarm:

- **Supervisor Agent**: The orchestrator. Analyzes the incoming objective, checks past intelligence memory for similar tasks, and routes the work to the appropriate specialist agent.
- **Developer Agent**: Specializes in code logic. Utilizes tools like `code_search` and `predict_impact` to safely navigate and modify codebases.
- **Research Agent**: Specializes in deep fact-finding. Utilizes the integrated ECHO `search_tool` and `scrape_tool` to pull live data, verify credibility, and synthesize reports.
- **Critic Agent**: The gatekeeper. Every specialist output is scrutinized by the global Critic. If a hallucination, logic gap, or syntax error is detected, the Critic issues a `requires_revision` flag, forcing the agent to try again before sending the payload to the user.

---

## 🛠 Features Developed

- **Unified Intelligence Memory:** A cross-runtime memory layer that stores problem-solving heuristics. If ECHO solves a complex bug once, it embeds the solution. The next time a similar problem arises, the Supervisor injects the cached strategy.
- **Tool Abstraction (UACP):** All agents communicate via the *Unified Agent Communication Protocol*, ensuring inputs/outputs between components remain strictly typed and predictable (confidence scores, citations, revision loops).
- **Stealth / Auto-Launch:** `launch_echo_react.bat` instantly boots the backend and frontend simultaneously, handling port negotiations and auto-launching the web interface.
- **Performance Aware:** Dynamic offloading of models and active telemetry (CPU/RAM monitoring) ensure the system doesn't crash low-spec hardware during massive parallel swarm operations.

---

## ⚙️ Quick Start Installation

### Prerequisites

- Node.js (v18+)
- Python 3.10+
- An LLM GGUF model placed in `ai-orchestrator/models/` (e.g., `llama-3.1-8b.gguf`)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/Project-ECHO.git
cd Project-ECHO

# 2. Start both the Backend and Frontend with one click On Windows:
launch_echo_react.bat
```

*Alternatively, start them manually:*

**Backend:**

```bash
cd ai-orchestrator
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python ..\api\server.py
```

**Frontend:**

```bash
cd ai-ui
npm install
npm run start
```

---

## 🏗 Directory Structure

```text
Project ECHO/
├── ai-orchestrator/          # Python AI Core
│   ├── agents/               # Supervisor, Critic, AgentManager
│   ├── core/                 # Mode controllers, telemetry, router
│   ├── intelligence/         # Hybrid memory (FAISS/SQLite)
│   ├── memory/               # Short-term / Session context
│   ├── runtime/              # Profiles (Developer, Research)
│   └── tools/                # ECHO web scraping, searching tools
├── ai-ui/                    # React + Tailwind Frontend
│   ├── src/components/       # MultiAgentPanel, ChatBubble
│   └── src/pages/            # Main layout and chat container
├── api/                      # FastAPI Endpoints (/query)
└── launch_echo_react.bat     # One-click startup script
```

## 📜 Future Roadmap

- Real-time token streaming via WebSockets to the UI
- Advanced semantic trace visualization
- Deep Seek R1 Cloud API failover routing
