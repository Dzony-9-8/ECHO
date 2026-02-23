import os

# ECHO V2 Hybrid System Configuration

ACTIVE_PROVIDER = os.getenv("ACTIVE_PROVIDER", "ollama")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "llama3.1:8b")
ENABLE_RAG = os.getenv("ENABLE_RAG", "True").lower() in ("true", "1", "t")
ENABLE_WEB = os.getenv("ENABLE_WEB", "False").lower() in ("true", "1", "t")
ENABLE_WEATHER = os.getenv("ENABLE_WEATHER", "True").lower() in ("true", "1", "t")
WEATHER_CACHE_TTL = int(os.getenv("WEATHER_CACHE_TTL", "600"))
DEFAULT_LOCATION = os.getenv("DEFAULT_LOCATION", "Belgrade")
MAX_RESEARCH_DEPTH = int(os.getenv("MAX_RESEARCH_DEPTH", "3"))
MAX_EXECUTION_TIME = int(os.getenv("MAX_EXECUTION_TIME", "30"))

# Database Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./backend/assistant_memory.db")
VECTOR_DB_PATH = os.getenv("VECTOR_DB_PATH", "./backend/vector_db")

# Safety constraints
MAX_BRANCHES = 3
MAX_TOKENS_PER_REQUEST = 8192
