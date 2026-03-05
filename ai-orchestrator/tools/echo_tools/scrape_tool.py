import requests
from bs4 import BeautifulSoup
import trafilatura
from typing import Dict, Any, List
from urllib.parse import urlparse
import time
from tools.echo_tools.memory_adapter import MemoryAdapter

class ScrapeTool:
    """
    Wraps ECHO's scraping logic as an agent tool.
    """

    def __init__(self, memory_adapter: MemoryAdapter):
        self.memory = memory_adapter

    def execute(self, url: str, timeout: int = 10) -> Dict[str, Any]:
        start_time = time.time()
        try:
            time.sleep(0.5) # Politeness delay
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (Project ECHO)'}
            response = requests.get(url, headers=headers, timeout=timeout)
            response.raise_for_status()
            
            content = trafilatura.extract(response.text, include_comments=False, include_tables=True, no_fallback=False)
            
            # Use html.parser instead of lxml
            soup = BeautifulSoup(response.text, 'html.parser')
            title_tag = soup.find('title')
            title = title_tag.get_text().strip() if title_tag else ""
                
            if not content:
                # Fallback
                for script in soup(['script', 'style', 'nav', 'footer', 'header']):
                    script.decompose()
                text = soup.get_text(separator='\n', strip=True)
                lines = [line.strip() for line in text.splitlines() if line.strip()]
                content = '\n'.join(lines)
                
            if not content:
                raise ValueError("No readable content could be extracted.")
                
            domain = urlparse(url).netloc.lower()
            success = True
            
            # Log to memory
            self.memory.record_task(
                task_type="scrape",
                confidence=0.9,
                success=True,
                notes=f"Scraped {url} | Found {len(content)} chars.",
                tags=["scrape", "article", domain]
            )
            
            return {
                "agent": "research_agent",
                "task_id": url,
                "analysis": "Performed web scraping.",
                "output": {
                    "title": title,
                    "content": content[:15000], # Cap size for context window
                    "url": url
                },
                "confidence": 0.9,
                "requires_revision": False,
                "notes_for_memory": "Scrape logged.",
                "execution_time_ms": int((time.time() - start_time) * 1000)
            }
        except Exception as e:
            self.memory.record_task(
                task_type="scrape",
                confidence=0.0,
                success=False,
                notes=f"Scrape failed: {url} | Error: {str(e)}",
                tags=["scrape", "error"]
            )
            return {
                "agent": "research_agent",
                "task_id": url,
                "analysis": f"Scrape failed: {str(e)}",
                "output": None,
                "confidence": 0.0,
                "requires_revision": True,
                "notes_for_memory": "Scrape error logged.",
                "execution_time_ms": int((time.time() - start_time) * 1000)
            }
