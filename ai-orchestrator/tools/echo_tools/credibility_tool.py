from tools.echo_tools.memory_adapter import MemoryAdapter
from urllib.parse import urlparse

# Known credible domains (from legacy web_scraper.py)
CREDIBLE_DOMAINS = {
    'wikipedia.org': 0.95,
    'britannica.com': 0.9,
    'nature.com': 0.95,
    'science.org': 0.95,
    'nytimes.com': 0.85,
    'reuters.com': 0.9,
    'bbc.com': 0.9,
    'cnn.com': 0.8,
    'gov': 0.95,
    'edu': 0.9,
}

class CredibilityTool:
    """
    Wraps ECHO's source credibility scoring as an agent tool.
    """

    def __init__(self, memory_adapter: MemoryAdapter):
        self.memory = memory_adapter

    def score(self, url: str) -> float:
        """Score the credibility of a single source based on domain."""
        try:
            domain = urlparse(url).netloc.lower()
            return next(
                (score for credible_domain, score in CREDIBLE_DOMAINS.items() if credible_domain in domain),
                0.5
            )
        except Exception:
            return 0.3

    def execute(self, sources: list):
        """
        Executes the credibility check against a list of URLs/sources,
        returning a UACP agent payload.
        """
        scored = []
        for url in sources:
            s_score = self.score(url)
            scored.append({"url": url, "score": s_score})
            
        top_score = max((s['score'] for s in scored), default=0.0)

        # Log memory
        self.memory.record_task(
            task_type="credibility",
            confidence=top_score,
            success=bool(scored),
            notes=f"Sources scored: {len(scored)}",
            tags=["credibility", "validation"]
        )

        return {
            "agent": "critic_agent",
            "task_id": "credibility_check",
            "analysis": "Scored source credibility.",
            "output": scored,
            "confidence": top_score,
            "requires_revision": top_score < 0.7,
            "notes_for_memory": "Credibility logged using validation bounds."
        }
