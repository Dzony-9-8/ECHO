"""Importance scorer — decides what is worth storing in long-term memory."""


class ImportanceScorer:
    """Score 0.0–1.0; only store when >= 0.4 (or user explicitly asks to remember)."""

    def __init__(self, keywords: list[str] | None = None):
        self.keywords = keywords or [
            "always", "never", "prefer", "my system",
            "important", "remember", "from now on",
        ]

    def score(self, text: str) -> float:
        if not text or not text.strip():
            return 0.0
        score = 0.2
        lower = text.lower()
        for k in self.keywords:
            if k in lower:
                score += 0.15
        return min(score, 1.0)
