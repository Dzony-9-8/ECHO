"""
ECHO V4 — Local OpenAI-Compatible Adapter (backend/app/llm/local_openai_adapter.py)
Targets any server that speaks the OpenAI /v1/chat/completions protocol:
  - LM Studio (default port 1234)
  - llama.cpp server
  - Oobabooga text-generation-webui (--extensions openai)
"""
from .base import LLMAdapter
import requests
import json
from ..core.config import LOCAL_OPENAI_URL, DEFAULT_MODEL

class LocalOpenAIAdapter(LLMAdapter):
    def __init__(self, base_url: str = None):
        self.base_url = (base_url or LOCAL_OPENAI_URL).rstrip("/")

    def generate(self, messages, temperature=0.7, images=None, model=None, **kwargs):
        resource_profile = kwargs.get("resource_profile", "balanced")
        ctx_map = {"low": 2048, "balanced": 4096, "high": 8192}
        max_tokens = ctx_map.get(resource_profile, 4096)

        url = f"{self.base_url}/chat/completions"
        payload = {
            "model":       model or DEFAULT_MODEL,
            "messages":    messages,
            "temperature": temperature,
            "max_tokens":  max_tokens,
            "stream":      False
        }
        response = requests.post(url, json=payload, timeout=120)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

    def generate_stream(self, messages, temperature=0.7, images=None, model=None, **kwargs):
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model":       model or DEFAULT_MODEL,
            "messages":    messages,
            "temperature": temperature,
            "stream":      True
        }
        with requests.post(url, json=payload, stream=True, timeout=120) as response:
            for line in response.iter_lines():
                if line:
                    raw = line.decode("utf-8").removeprefix("data: ").strip()
                    if raw == "[DONE]":
                        break
                    try:
                        chunk = json.loads(raw)
                        delta = chunk["choices"][0].get("delta", {})
                        if "content" in delta:
                            yield delta["content"]
                    except json.JSONDecodeError:
                        continue
