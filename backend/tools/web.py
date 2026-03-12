"""
ECHO V3 — Web Search Tool Wrapper
Wraps backend/core/web_engine.py behind the standard Tool interface.
"""

from .base import Tool
from ..core.web_engine import web_engine

class WebTool(Tool):
    name = "web_search"
    description = "Searches the web using DuckDuckGo and returns a summarized context string."

    def execute(self, input_data: dict) -> dict:
        query = input_data.get("query", "")
        if not query:
            return {"result": "", "error": "No query provided."}
        if not getattr(web_engine, "enabled", False):
            return {"result": "(Web search disabled or ddgs not installed.)", "error": None}
        context = web_engine.get_context_string(query)
        return {"result": context, "error": None}
