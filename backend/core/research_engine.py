import time
from ..config import MAX_RESEARCH_DEPTH, MAX_EXECUTION_TIME
from .web_engine import web_engine
from .rag_engine import rag_engine
from ..llm.registry import get_llm_adapter

class ResearchEngine:
    def execute_research(self, query: str, depth: int):
        depth = min(depth, MAX_RESEARCH_DEPTH)
        if depth <= 0:
            return ""
        
        start_time = time.time()
        findings = []
        adapter = get_llm_adapter()
        
        current_query = query
        for round_num in range(depth):
            if time.time() - start_time > MAX_EXECUTION_TIME:
                findings.append("Research timed out.")
                break
                
            web_results = web_engine.search(current_query, max_results=3)
            if not web_results:
                break
                
            summary = "\n".join([f"- {r.get('body')}" for r in web_results])
            findings.append(f"Round {round_num + 1} findings: {summary}")
            
            prompt = f"Based on these findings: {summary}. What is a good follow-up search query to learn more about: {query}? Respond with JUST the query."
            messages = [{"role": "user", "content": prompt}]
            next_query = adapter.generate(messages, temperature=0.5)
            current_query = next_query[:100].strip().strip('"').strip("'")

        if not findings:
            return ""

        final_report = "Autonomous Research Report:\n" + "\n".join(findings)
        rag_engine.ingest_text(final_report, metadata={"type": "research", "query": query})
        
        return final_report

research_engine = ResearchEngine()
