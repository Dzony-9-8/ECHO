"""
ECHO V3 — RAG Retrieval Tool Wrapper
Wraps backend/core/rag_engine.py behind the standard Tool interface.
"""

from .base import Tool
from ..core.rag_engine import rag_engine

class RAGTool(Tool):
    name = "rag_retrieve"
    description = "Retrieves relevant knowledge chunks from the local vector database."

    def execute(self, input_data: dict) -> dict:
        query = input_data.get("query", "")
        if not query:
            return {"result": [], "error": "No query provided."}
        if not getattr(rag_engine, "enabled", False):
            return {"result": [], "error": "(RAG not available — chromadb/sentence-transformers not installed.)"}
        chunks = rag_engine.retrieve(query)
        return {"result": chunks, "error": None}
