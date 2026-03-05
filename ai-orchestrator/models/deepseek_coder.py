"""Coding specialist — DeepSeek-Coder; code only, no conversation or persona."""
from typing import Any


class DeepSeekCoder:
    def __init__(self, model: Any):
        self.model = model

    def run(self, task: str) -> str:
        prompt = f"""
You are a professional software engineer.

Rules:
- Output ONLY code or technical explanations
- NO conversation
- NO persona
- NO emojis
- Be correct and explicit

Task:
{task}
"""
        res = self.model(prompt, max_tokens=1024)
        return res["choices"][0]["text"].strip()
