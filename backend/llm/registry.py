from .ollama_adapter import OllamaAdapter
from ..config import ACTIVE_PROVIDER

_adapters = {
    "ollama": OllamaAdapter(),
    # Other providers can be registered here in the future
}

def get_llm_adapter():
    provider = ACTIVE_PROVIDER.lower()
    if provider not in _adapters:
        raise ValueError(f"Unknown provider '{provider}'")
    return _adapters[provider]
