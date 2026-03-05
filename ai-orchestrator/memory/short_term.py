"""Session memory — last N turns in RAM."""
from typing import Literal


Role = Literal["user", "ai"]


class ShortTermMemory:
    def __init__(self, max_turns: int = 10):
        self.max_turns = max_turns
        self.buffer: list[tuple[str, str]] = []

    def add(self, role: str, content: str) -> None:
        self.buffer.append((role, content))
        while len(self.buffer) > self.max_turns:
            self.buffer.pop(0)

    def context(self) -> str:
        return "\n".join(f"{r}: {c}" for r, c in self.buffer)
