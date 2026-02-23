from .base import LLMAdapter
import requests
import json
from ..config import DEFAULT_MODEL

class OllamaAdapter(LLMAdapter):
    def __init__(self, endpoint="http://localhost:11434"):
        self.endpoint = endpoint
        
    def _format_messages(self, messages, images=None):
        formatted = []
        for index, msg in enumerate(messages):
            msg_data = {"role": msg["role"], "content": msg["content"]}
            # Attach images to the last user message if provided
            if images and msg["role"] == "user" and index == len(messages) - 1:
                msg_data["images"] = images
            formatted.append(msg_data)
        return formatted

    def generate(self, messages, temperature=0.7, images=None, model=None, **kwargs):
        url = f"{self.endpoint}/api/chat"

        # V3: Resource-adaptive context window
        resource_profile = kwargs.get("resource_profile", "balanced")
        ctx_map = {"low": 2048, "balanced": 4096, "high": 8192}
        num_ctx = ctx_map.get(resource_profile, 4096)

        payload = {
            "model": model or DEFAULT_MODEL,
            "messages": self._format_messages(messages, images),
            "options": {"temperature": temperature, "num_ctx": num_ctx},
            "stream": False
        }

        response = requests.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        return data.get("message", {}).get("content", "")

    def generate_stream(self, messages, temperature=0.7, images=None, model=None, **kwargs):
        url = f"{self.endpoint}/api/chat"
        payload = {
            "model": model or DEFAULT_MODEL,
            "messages": self._format_messages(messages, images),
            "options": {"temperature": temperature},
            "stream": True
        }
        with requests.post(url, json=payload, stream=True) as response:
            for line in response.iter_lines():
                if line:
                    chunk = json.loads(line)
                    if "message" in chunk and "content" in chunk["message"]:
                        yield chunk["message"]["content"]
