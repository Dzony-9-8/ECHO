"""Episodic memory — conversation summaries with timestamps."""
import time


class EpisodicMemory:
    def __init__(self):
        self.episodes: list[dict] = []

    def add(self, summary: str) -> None:
        self.episodes.append({
            "summary": summary,
            "timestamp": time.time(),
        })

    def recent(self, n: int = 3) -> list[str]:
        return [e["summary"] for e in self.episodes[-n:]]
