from ddgs import DDGS
from typing import Dict, Any, List
import time
from tools.echo_tools.memory_adapter import MemoryAdapter

class SearchTool:
    """
    Wraps ECHO's search functionality as an agent tool.
    """

    def __init__(self, memory_adapter: MemoryAdapter):
        self.memory = memory_adapter

    def execute(self, query: str, max_results: int = 5) -> Dict[str, Any]:
        start_time = time.time()
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=max_results))
                
            top_result = results[0] if results else None
            
            formatted_results = [
                {
                    "title": r.get('title', 'No Title'),
                    "url": r.get('href', 'No Link'),
                    "snippet": r.get('body', 'No Content')
                }
                for r in results
            ] if results else []
            
            # Log to memory
            self.memory.record_task(
                task_type="search",
                confidence=0.85 if top_result else 0.0,
                success=bool(top_result),
                notes=f"Query: {query} | Found: {len(formatted_results)} results. Top: {top_result}",
                tags=["search", "web_data"]
            )
            
            return {
                "agent": "research_agent",
                "task_id": query,
                "analysis": "Performed web search.",
                "output": formatted_results or "No results found for the query.",
                "confidence": 0.85 if top_result else 0.0,
                "requires_revision": not bool(top_result),
                "notes_for_memory": "Query logged in shared memory",
                "execution_time_ms": int((time.time() - start_time) * 1000)
            }
        except Exception as e:
            self.memory.record_task(
                task_type="search",
                confidence=0.0,
                success=False,
                notes=f"Query failed: {query} | Error: {str(e)}",
                tags=["search", "error"]
            )
            return {
                "agent": "research_agent",
                "task_id": query,
                "analysis": f"Search execution error: {str(e)}",
                "output": None,
                "confidence": 0.0,
                "requires_revision": True,
                "notes_for_memory": "Search failed with error.",
                "execution_time_ms": int((time.time() - start_time) * 1000)
            }
