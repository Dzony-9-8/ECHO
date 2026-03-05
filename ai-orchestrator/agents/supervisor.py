from typing import List
from agents.protocol import UACPPayload
import time

class SupervisorAgent:
    """Orchestrator for agent task assignment and result merging."""

    def __init__(self, memory):
        self.memory = memory

    def decide(self, objective) -> str:
        """
        Intelligent task classification.
        Decides: 'dev' | 'research'
        """
        obj_lower = objective.lower()
        
        # Analyze past task similarity using IntelligenceLayer
        try:
            if history := self.memory.search_past_insight(objective, top_k=2):
                # If past similar tasks were heavily research-oriented or needed web data
                for score, meta in history:
                    tags = meta.get("tags", [])
                    if "search" in tags or "scrape" in tags or "research" in tags:
                        print(f"--- Supervisor: Routing to Research based on memory match (Score: {score:.2f}) ---")
                        return "research"
        except Exception as e:
            print(f"--- Supervisor: Memory check failed: {e} ---")
            
        # Fallback keyword-based classification
        if any(w in obj_lower for w in ["refactor", "implement", "code", "fix", "feature"]):
            return "dev"
        if any(w in obj_lower for w in ["research", "design", "architecture", "plan", "analyze", "find out"]):
            return "research"
        
        return "dev"

    def merge(self, outputs: List[UACPPayload]) -> UACPPayload:
        """Merges multiple specialist outputs into a single UACP payload."""
        merged_result = "\n\n".join([f"--- Agent Result ---\n{o.output}" for o in outputs])
        
        return UACPPayload(
            agent="supervisor",
            analysis="Aggregated results from multiple specialists.",
            output=merged_result,
            confidence=sum(o.confidence for o in outputs) / len(outputs) if outputs else 0.0,
            notes_for_memory="Swarm execution merged."
        )
