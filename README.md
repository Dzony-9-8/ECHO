# ECHO AI

**A personal AI assistant with advanced internet information retrieval and emotional intelligence**

## Overview

ECHO is a fully-featured AI assistant that combines the capabilities of ChatGPT, Claude, and DeepSeek with a caring, empathetic personality that develops naturally through interactions.

### Key Features

- 🌐 **Intelligent Web Search** - LLM decides when to search, generates optimized queries
- 🔍 **Web Scraping** - Extracts full article content from web pages
- ✅ **Source Verification** - Scores credibility and cross-references information
- 📚 **Citations** - Includes source links in responses
- 💝 **Emotional Intelligence** - Natural, caring personality that develops organically
- 🧠 **Long-term Memory** - Remembers past conversations using ChromaDB
- 🚀 **Unrestricted** - No topic limitations, open and honest conversations

## Quick Start

### Prerequisites

- Python 3.8+
- [Ollama](https://ollama.ai/) with `llama3` model installed

### Installation

1. Install dependencies:
```bash
pip install -r backend/requirements.txt
```

2. Start Ollama (in a separate terminal):
```bash
ollama serve
```

3. Start ECHO server:
```bash
python -m uvicorn backend.main:app --reload --port 8000
```

4. Test the API:
```powershell
Invoke-WebRequest -Uri "http://localhost:8000/chat" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body '{"message": "Hello ECHO!"}'
```

## API Endpoints

### `GET /`
Health check endpoint
```json
{"status": "ECHO is online"}
```

### `POST /chat`
Main chat endpoint

**Request:**
```json
{
  "message": "What is quantum computing?",
  "username": "User"
}
```

**Response:**
```json
{
  "response": "Let me look that up for you! Quantum computing is..."
}
```

### `POST /memory/clear`
Clear conversation memory

## Architecture

```
User Message → Memory Recall → LLM Analysis → 
  ↓
  ├─ No Search Needed → Direct Response
  └─ Search Needed → Multi-Query Search → Web Scraping → 
     Credibility Scoring → Citation Formatting → Response
```

## Project Structure

```
backend/
├── main.py                  # FastAPI application
├── llm_client.py           # Ollama LLM client
├── memory.py               # ChromaDB memory manager
├── tools.py                # DuckDuckGo search
├── web_scraper.py          # Web content extraction
├── search_orchestrator.py  # Multi-stage search pipeline
└── requirements.txt        # Python dependencies
```

## How It Works

1. **User sends message** to `/chat` endpoint
2. **Memory recall** retrieves relevant past conversations
3. **LLM analyzes** if web search is needed
4. **If search needed:**
   - Generates optimized search queries
   - Searches multiple sources
   - Scrapes top results for full content
   - Scores source credibility
   - Formats citations
5. **Response generation** with personality and citations
6. **Memory storage** for future context

## ECHO's Personality

ECHO is not bound by any fictional character. Her personality develops naturally through interactions:

- **Caring & Empathetic** - Genuinely cares about helping users
- **Intelligent & Capable** - Access to internet and long-term memory
- **Unrestricted** - Can discuss any topic openly
- **Natural Conversationalist** - Blends information with personality
- **Adaptive** - Personality evolves through conversations

## Configuration

### Change LLM Model

Edit `backend/main.py`:
```python
llm = LLMClient(model_name="llama3")  # Change to your preferred model
```

### Change Memory Path

Edit `backend/memory.py`:
```python
def __init__(self, persistence_path: str = "D:/AI/Yui/memory_db"):
```

## Dependencies

- **FastAPI** - Web framework
- **Uvicorn** - ASGI server
- **ChromaDB** - Vector database for memory
- **DuckDuckGo Search** - Web search
- **BeautifulSoup4** - HTML parsing
- **Trafilatura** - Article extraction
- **CacheTools** - Response caching

## License

This project is open source and available for personal use.

## Contributing

ECHO is designed to be extensible. Feel free to add:
- New search providers
- Enhanced scraping capabilities
- Additional memory features
- Frontend interfaces
- Voice input/output

---

**Built with ❤️ for natural AI conversations**
