"""
ECHO V4 — Centralised Config (backend/app/core/config.py)
Single source of truth for all environment-driven settings.
"""
import os

# ── LLM ─────────────────────────────────────────────────────────────────────
ACTIVE_PROVIDER   = os.getenv("ACTIVE_PROVIDER", "ollama")   # "ollama" | "local_openai"
DEFAULT_MODEL     = os.getenv("DEFAULT_MODEL", "llama3.1:8b")
OLLAMA_ENDPOINT   = os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434")
LOCAL_OPENAI_URL  = os.getenv("LOCAL_OPENAI_URL", "http://localhost:1234/v1")  # LM Studio / llama.cpp

# ── Features ─────────────────────────────────────────────────────────────────
ENABLE_RAG        = os.getenv("ENABLE_RAG",     "True").lower() in ("true", "1", "t")
ENABLE_WEB        = os.getenv("ENABLE_WEB",     "False").lower() in ("true", "1", "t")
ENABLE_WEATHER    = os.getenv("ENABLE_WEATHER", "True").lower() in ("true", "1", "t")

# ── Weather ───────────────────────────────────────────────────────────────────
WEATHER_CACHE_TTL  = int(os.getenv("WEATHER_CACHE_TTL", "600"))
DEFAULT_LOCATION   = os.getenv("DEFAULT_LOCATION", "Belgrade")

# ── Research / Safety ─────────────────────────────────────────────────────────
MAX_RESEARCH_DEPTH    = int(os.getenv("MAX_RESEARCH_DEPTH", "3"))
MAX_EXECUTION_TIME    = int(os.getenv("MAX_EXECUTION_TIME", "30"))
MAX_BRANCHES          = 3
MAX_TOKENS_PER_REQUEST = 8192

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL   = os.getenv("DATABASE_URL",   "sqlite:///./backend/assistant_memory.db")
VECTOR_DB_PATH = os.getenv("VECTOR_DB_PATH", "./backend/vector_db")

# ── V4 Portable / Storage ─────────────────────────────────────────────────────
ECHO_MODE         = os.getenv("ECHO_MODE",         "desktop")  # "desktop" | "portable"
ECHO_STORAGE_ROOT = os.getenv("ECHO_STORAGE_ROOT", "./data")
ECHO_API_KEY      = os.getenv("ECHO_API_KEY",      "")         # Empty = no auth required

# ── App Meta ──────────────────────────────────────────────────────────────────
APP_VERSION = "4.0.0"
APP_TITLE   = "ECHO AI"
