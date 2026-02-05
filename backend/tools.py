from ddgs import DDGS
from typing import List, Dict

def search_web(query: str, max_results: int = 5) -> str:
    """Performs a web search and returns a summary of results."""
    try:
        # Use DDGS context manager for better connection handling
        with DDGS() as ddgs:
            results = [r for r in ddgs.text(query, max_results=max_results)]
            
        if not results:
            return "No results found."
        
        formatted_results = []
        for r in results:
            title = r.get('title', 'No Title')
            link = r.get('href', 'No Link')
            body = r.get('body', 'No Content')
            formatted_results.append(f"Title: {title}\nLink: {link}\nSummary: {body}")
            
        return "\n\n".join(formatted_results)
    except Exception as e:
        return f"Error performing search: {e}"

