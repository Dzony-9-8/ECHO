# ECHO V2 Architecture & Context Prompt

**Usage:** *You can provide this prompt to any LLM (like ChatGPT, Claude, or a local model) to instantly give it full context on the ECHO project codebase, architecture, and current capabilities so it can help you maintain or expand it.*

---

## **PROJECT OVERVIEW**

**Name:** ECHO (Hybrid AI Assistant)
**Version:** 2.0 (Modular Orchestrator Upgrade)
**Architecture:** OpenAI-Compatible API Backend (FastAPI/Python) + Desktop Frontend (React/Vite/Electron)
**Core LLM:** Local inference via Ollama (default model: `llama3.1:8b`).

ECHO V2 is not a monolithic script. It is a highly modular AI platform built to orchestrate multiple "Engines" (Web, RAG, Weather, Research) behind the scenes, injecting context into a dynamic system prompt before sending an OpenAI-formatted payload to the local LLM.

## **TECH STACK**

- **Backend:** Python 3, FastAPI, Uvicorn, SQLAlchemy (SQLite), Pydantic.
- **AI/ML:** `sentence-transformers` (all-MiniLM-L6-v2), `chromadb` (Vector DB), `ollama` (LLM inference).
- **Web/APIs:** `ddgs` (DuckDuckGo Search), `Open-Meteo` (Weather/Geocoding).
- **Frontend:** React 19, Vite, Electron (wrapper), vanilla CSS (dark mode/glassmorphism UI).
- **Protocols:** The backend perfectly mimics the `POST /v1/chat/completions` OpenAI standard but includes custom ECHO extensions like `web_enabled`, `rag_enabled`, `weather_enabled`, and `research_depth`.

---

## **DIRECTORY STRUCTURE & MODULES**

### **1. Backend (`backend/`)**

The brain of ECHO. Runs on `http://127.0.0.1:8000`.

- **`config.py`**: Global settings (e.g., `ENABLE_RAG`, `ENABLE_WEB`, `ENABLE_WEATHER`, `WEATHER_CACHE_TTL`, default models/locations).
- **`main.py`**: FastAPI app initialization and CORS setup.
- **`api/openai_routes.py`**: Defines standard REST routes. Exposes `/v1/chat/completions` which passes parameters down to the orchestrator. Contains a mock endpoint for `/v1/audio/transcriptions`.
- **`database/models.py`**: SQLAlchemy definitions (`Conversation` history, `WeatherCache`, `UserProfile`).

### **2. Core Engines (`backend/core/`)**

The modules that do the actual work before the LLM sees the prompt.

- **`orchestrator.py`**: The central nervous system. Takes the incoming API payload, checks which toggles/intents are active, triggers the respective engines, builds a massive contextual `system_prompt`, and passes it to the LLM adapter.
- **`router.py`**: Defines AI persona "Modes" (chat, analysis, research, code, agent, weather) which alter the base system prompt and generation temperature.
- **`weather_engine.py`**: Fetches real-time weather and 7-day forecasts from Open-Meteo API. Caches results in SQLite for 10 minutes.
- **`intent_detector.py`**: Uses NLP to silently read user prompts (e.g., "Will it rain in Tokyo?") and trigger the Weather Engine automatically without requiring strict OpenAI Tool Calls from the LLM.
- **`web_engine.py`**: Uses `ddgs` to scrape live internet results to inject web context.
- **`rag_engine.py`**: Local knowledge base using ChromaDB and Sentence-Transformers to inject relevant document chunks into memory. Safely skips loading if dependencies fail.
- **`research_engine.py`**: An autonomous loop that uses the web engine iteratively to perform deep research based on the `research_depth` parameter.
- **`image_engine.py`**: Parses base64 images for multimodal computer vision.
- **`memory_engine.py`**: Handles basic conversation database logging.

### **3. LLM Adapter Layer (`backend/llm/`)**

Abstracts the LLM provider so ECHO isn't strictly tied to Ollama natively.

- **`base.py`**: Abstract `LLMAdapter` interface.
- **`ollama_adapter.py`**: Translates the OpenAI format into standard Ollama requests and returns the generated text.
- **`registry.py`**: Returns the active adapter based on `config.py`.

### **4. Frontend (`frontend/`)**

A React UI wrapped in Electron to act as a native desktop app.

- **`desktop/main.cjs`**: The Electron main process. Acts as an IPC proxy connecting the React UI to the `8000` Python backend.
- **`src/components/Chat.jsx`**: The primary UI. Handles message history, drag-and-drop file uploads (converted to text or base64 images), and UI toggles (Web 🌐, RAG 🧠, Weather ⛅, Research Depth Slider, Mode Dropdown). Sends everything to `chat-request` IPC or directly to port 8000.
- **`src/components/WeatherPanel.jsx`**: A sliding, collapsible UI widget that renders on the bottom right if the backend orchestrator successfully returns a `"weather_data": {}` JSON block. Shows WMO weather emojis and a 7-day forecast.
- **`src/components/InsightPanel.jsx`**: A drop-down menu that shows behind-the-scenes metrics (RAG chunks found, Web links scraped, research rounds completed).
- **`src/utils/`**: Utilities to export chat logs to `.txt` or `.pdf`.

---

## **SYSTEM FLOW EXAMPLES**

**Scenario 1: Standard Chat**
User types "Hello" -> Frontend sends to port `8000` -> `orchestrator.py` assigns 'chat' mode -> `ollama_adapter.py` generates standard response -> Frontend renders `MessageBubble`.

**Scenario 2: Weather Query (Implicit Intent)**
User toggles 'Weather' UI button and types "What is the weather in Paris?" -> `intent_detector.py` parses "Paris" -> `weather_engine.py` geocodes Paris and gets forecast from Open-Meteo -> `orchestrator.py` forces 'weather' Mode and injects factual weather JSON into system prompt -> LLM summarizes the weather beautifully -> Backend returns response + `weather_data` dict -> Frontend renders assistant text AND visually mounts `WeatherPanel.jsx`.

**Scenario 3: Deep Research**
User sets depth slider to 3, types "Quantum Computing" -> `orchestrator` routes to `research_engine` -> Engine iteratively searches DuckDuckGo, summarizes pages, defines new search terms for 3 rounds -> Appends massive research context to system prompt -> LLM writes final comprehensive report.

---

## **HOW TO START THE APP**

The root directory contains `launch_echo.bat`, which gracefully handles starting both layers:

1. Kills orphaned ports/processes.
2. Starts the FastAPI backend via `uvicorn backend.main:app --host 127.0.0.1 --port 8000`.
3. Starts the Vite + Electron frontend via `npm run start` inside the `frontend/` folder.
