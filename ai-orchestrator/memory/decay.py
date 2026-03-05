"""Decay — forgetting curve for long-term memory relevance."""
import time


class MemoryDecay:
    def __init__(self, half_life_days: float = 30):
        self.half_life_seconds = half_life_days * 86400

    def decay_factor(self, timestamp: float) -> float:
        age = time.time() - timestamp
        return 0.5 ** (age / self.half_life_seconds)
