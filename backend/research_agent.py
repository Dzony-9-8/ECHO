"""
Research Agent module for ECHO AI.
Implements recursive "Deep Research" capabilities.
"""

import json
import time
from typing import List, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed
from .search_orchestrator import perform_search, extract_content_from_sources
from .llm_client import LLMClient

class ResearchAgent:
    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client
        self.max_depth = 2
        self.breadth = 3
        
    def deep_research(self, query: str, depth: int = 2, breadth: int = 3, provider: str = "duckduckgo") -> Dict:
        """
        Execute a deep research loop.
        
        Args:
            query: The user's research topic.
            depth: How many levels of recursion (default 2).
            breadth: How many parallel searches per level (default 3).
            provider: Search provider to use.
            
        Returns:
            Dict containing the final report and the research log.
        """
        self.max_depth = depth
        self.breadth = breadth
        research_log = []
        
        # 1. Initial Planning
        research_log.append({"step": "planning", "message": f"Analyzing query: '{query}'..."})
        plan = self._generate_plan(query)
        
        all_findings = []
        
        # 2. Recursive Execution
        # We start with the initial sub-questions from the plan
        current_questions = plan.get('sub_questions', [query])
        
        for level in range(1, depth + 1):
            research_log.append({"step": "level_start", "level": level, "message": f"Starting Research Level {level}/{depth}..."})
            
            level_results = self._execute_level(current_questions, provider)
            
            # Analyze findings to see if we need more depth
            analysis = self._analyze_level_results(query, level_results, all_findings)
            all_findings.extend(level_results)
            research_log.extend([{"step": "finding", "message": f"Found: {r['title']}"} for r in level_results])
            
            if level < depth:
                # Generate next level questions based on what we missed
                new_questions = analysis.get('follow_up_questions', [])
                if not new_questions:
                    research_log.append({"step": "early_stop", "message": "Sufficient information gathered."})
                    break
                current_questions = new_questions[:breadth]
                research_log.append({"step": "refining", "message": f"Refining research with {len(current_questions)} new questions..."})
            
        # 3. Synthesis
        research_log.append({"step": "synthesizing", "message": "Compiling final report..."})
        final_report = self._synthesize_report(query, all_findings, analysis.get('summary', ''))
        
        return {
            "query": query,
            "report": final_report,
            "log": research_log,
            "sources": [f['url'] for f in all_findings]
        }

    def _generate_plan(self, query: str) -> Dict:
        """Generate a research plan with sub-questions."""
        prompt = f"""Plan a deep research session for the topic: "{query}"
        
        Generate 3-5 specific, distinct sub-questions that would help comprehensively answer this.
        Focus on finding facts, statistics, and detailed explanations.
        
        OUTPUT JSON ONLY:
        {{
            "sub_questions": ["question 1", "question 2", "question 3"]
        }}
        """
        response = self.llm.generate_response(prompt)
        try:
            return self._parse_json(response)
        except:
            return {"sub_questions": [query]}

    def _execute_level(self, questions: List[str], provider: str) -> List[Dict]:
        """Execute searches for a list of questions concurrently."""
        results = []
        
        def search_op(q):
            # 1. Search
            raw_res = perform_search(q, provider=provider, max_results=3)
            # 2. Extract content (using just snippets for speed, or scrape if needed)
            # For deep research, getting snippets is usually enough for the first pass, 
            # but scraping top 1 is better for quality.
            scraped = extract_content_from_sources(raw_res, max_sources=1)
            return scraped

        with ThreadPoolExecutor(max_workers=3) as executor:
            future_to_q = {executor.submit(search_op, q): q for q in questions}
            for future in as_completed(future_to_q):
                try:
                    data = future.result()
                    results.extend(data)
                except Exception as e:
                    print(f"Error in research thread: {e}")
                    
        return results

    def _analyze_level_results(self, original_query: str, new_findings: List[Dict], all_findings: List[Dict]) -> Dict:
        """Analyze findings and generate follow-up questions."""
        
        context_text = ""
        for f in new_findings:
            context_text += f"Source: {f.get('title', 'Unknown')}\nContent: {f.get('content', '')[:1000]}\n\n"
            
        prompt = f"""Analyze these research findings for the topic: "{original_query}"
        
        FINDINGS:
        {context_text}
        
        1. Summarize what has been found.
        2. Identify what is MISSING or unclear.
        3. Generate 2-3 follow-up questions to fill the gaps.
        
        OUTPUT JSON ONLY:
        {{
            "summary": "Brief summary of current knowledge...",
            "missing_info": "What is missing...",
            "follow_up_questions": ["question 1", "question 2"]
        }}
        """
        response = self.llm.generate_response(prompt)
        try:
            return self._parse_json(response)
        except:
            return {"summary": "Analysis failed", "follow_up_questions": []}

    def _synthesize_report(self, query: str, findings: List[Dict], partial_summary: str) -> str:
        """Create the final comprehensive report."""
        context_text = ""
        unique_urls = set()
        
        for f in findings:
            if f['url'] not in unique_urls:
                unique_urls.add(f['url'])
                context_text += f"\n--- Source: {f.get('title')} ---\n{f.get('content', '')[:1500]}\n"
        
        prompt = f"""Write a comprehensive "Deep Research Report" on: "{query}"
        
        Use the following gathered information.
        Structure the report with markdown headers, bullet points, and citations.
        Be extremely detailed and thorough.
        
        RESEARCH DATA:
        {context_text}
        
        REPORT FORMAT:
        # [Title]
        ## Executive Summary
        ...
        ## Detailed Findings
        ...
        ## Conclusion
        ...
        ### Sources
        ...
        """
        return self.llm.generate_response(prompt)

    def _parse_json(self, text: str) -> Dict:
        """Robust JSON parsing helper."""
        text = text.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        try:
            return json.loads(text.strip())
        except:
            return {}  # Avoid crash
