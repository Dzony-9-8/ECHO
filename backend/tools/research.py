"""
ECHO V3 — Research Tool Wrapper
Wraps backend/core/research_engine.py behind the standard Tool interface.
"""

from .base import Tool
from ..core.research_engine import research_engine

class ResearchTool(Tool):
    name = "deep_research"
    description = "Runs a multi-round autonomous research loop using DuckDuckGo to build a comprehensive report."

    def execute(self, input_data: dict) -> dict:
        query = input_data.get("query", "")
        depth = input_data.get("depth", 1)
        if not query:
            return {"result": "", "error": "No query provided."}
        try:
            report = research_engine.execute_research(query, depth)
            return {"result": report, "error": None}
        except Exception as e:
            return {"result": "", "error": str(e)}
