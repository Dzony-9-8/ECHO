import sys
import os
import asyncio
import json

# Debugging path
print(f"DEBUG: CWD: {os.getcwd()}")
print(f"DEBUG: sys.path: {sys.path}")

try:
    from backend.search_orchestrator import perform_search, intelligent_search
    from backend.research_agent import ResearchAgent
    from backend.llm_client import LLMClient
except ImportError as e:
    print(f"CRITICAL IMPORT ERROR: {e}")
    # Try alternate import style if running from inside backend? No, running from root.
    sys.exit(1)

# Mock LLM Client to avoid full Ollama dependency if not running, 
# but ideally we want to test with real one if available.
# We'll try to use the real one, but handle errors.

def test_search_orchestrator():
    print("--- Testing Search Orchestrator ---")
    try:
        results = perform_search("latest AI news", provider="duckduckgo", max_results=1)
        print(f"Search Results (Length: {len(results)}):")
        print(results[:200] + "...")
        if "AI" in results or "Title:" in results:
            print("SUCCESS: Search returned data.")
        else:
            print("WARNING: Search might be empty or blocked.")
    except Exception as e:
        print(f"ERROR: Search failed: {e}")

def main():
    test_search_orchestrator()
    
    # Test Research Agent Initialization
    print("\n--- Testing Research Agent Init ---")
    try:
        llm = LLMClient(model_name="llama3.1:8b") 
        agent = ResearchAgent(llm)
        print("SUCCESS: Research Agent initialized.")
        
        # We won't run full deep_research as it takes time and tokens, 
        # but we can test the plan generation if we mock the LLM response
        # or just trust the init for now.
        
    except Exception as e:
        print(f"ERROR: Research Agent Init failed: {e}")

if __name__ == "__main__":
    main()
