"""Reasoning specialist — DeepSeek-R1; supports both local GGUF and cloud API."""
from typing import Any
import json
import urllib.request
import urllib.error


class DeepSeekR1:
    def __init__(self, model: Any = None, api_key: str = "", is_cloud: bool = False):
        self.model = model
        self.api_key = api_key
        self.is_cloud = is_cloud

    def run(self, task: str) -> str:
        prompt = f"""You are a reasoning engine. Solve the task step by step.
Do NOT address the user. Do NOT use conversational tone.

Task:
{task}
"""
        if self.is_cloud and self.api_key:
            return self._call_cloud_api(prompt)

        if self.model:
            res = self.model(prompt, max_tokens=512)
            return res["choices"][0]["text"].strip()

        return "Reasoning engine not available."

    def _call_cloud_api(self, prompt: str) -> str:
        """Call DeepSeek-R1 via their OpenAI-compatible API."""
        print("--- Calling DeepSeek-R1 Cloud API ---")
        try:
            payload = json.dumps({
                "model": "deepseek-reasoner",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 1024,
                "temperature": 0.3,
            }).encode("utf-8")

            req = urllib.request.Request(
                "https://api.deepseek.com/chat/completions",
                data=payload,
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                method="POST",
            )

            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data["choices"][0]["message"]["content"]
                print(f"--- DeepSeek-R1 Response received ({len(content)} chars) ---")
                return content

        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            print(f"--- DeepSeek API Error {e.code}: {error_body} ---")
            return f"Cloud reasoning failed (HTTP {e.code}). Falling back to local analysis."
        except Exception as e:
            print(f"--- DeepSeek API Exception: {e} ---")
            return f"Cloud reasoning unavailable: {e}"
