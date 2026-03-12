"""
ECHO V4 — LLM Registry (backend/app/llm/registry.py)
Extends the V3 registry to support the new local_openai provider.
"""
from backend.llm.ollama_adapter import OllamaAdapter
from backend.llm.base import LLMAdapter
from .local_openai_adapter import LocalOpenAIAdapter
from ..core.config import ACTIVE_PROVIDER


def get_llm_adapter() -> LLMAdapter:
    if ACTIVE_PROVIDER == "local_openai":
        return LocalOpenAIAdapter()
    return OllamaAdapter()
