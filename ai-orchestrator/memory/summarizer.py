"""Conversation summarizer — compress dialogue into episodic bullets."""
from typing import Any


class ConversationSummarizer:
    """Uses the planner LLM to summarize; no persona, factual only."""

    def __init__(self, model: Any):
        self.model = model

    def summarize(self, dialogue: str) -> str:
        if not dialogue or not dialogue.strip():
            return "(empty)"
        prompt = f"""
Summarize the following conversation into a short factual memory.

Rules:
- No dialogue
- No opinions
- No fluff
- Max 5 bullet points

Conversation:
{dialogue}

Summary:
"""
        res = self.model(prompt, max_tokens=256)
        return res["choices"][0]["text"].strip()
