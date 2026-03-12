from ..config import ENABLE_WEB

class WebEngine:
    def __init__(self):
        self.enabled = ENABLE_WEB

    def search(self, query: str, max_results: int = 3):
        if not self.enabled:
            return []
        try:
            from duckduckgo_search import DDGS
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=max_results))
                return results
        except Exception as e:
            print(f"Web search error: {e}")
            return []

    def get_context_string(self, query: str):
        results = self.search(query)
        if not results:
            return ""
        context = "Web Research Summary:\n"
        for r in results:
            context += f"- {r.get('title')}: {r.get('body')} ({r.get('href')})\n"
        return context

web_engine = WebEngine()
