"""
ECHO V4 — Research Service (backend/app/services/research_service.py)
Façade over the ResearchTool for multi-round autonomous research.
"""
from ..core.logging import logger


class ResearchService:
    def __init__(self, research_tool):
        self.tool = research_tool

    def run(self, query: str, depth: int = 1) -> str:
        logger.info(f"[ResearchService] Starting research: '{query}' depth={depth}")
        result = self.tool.execute({"query": query, "depth": depth})
        if result.get("error"):
            logger.error(f"[ResearchService] Error: {result['error']}")
            return f"(Research failed: {result['error']})"
        logger.info("[ResearchService] Research complete.")
        return result.get("result", "")
