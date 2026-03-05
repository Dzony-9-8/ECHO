from research.recursive_planner import RecursivePlanner
from agents.protocol import UACPPayload
import time

class ResearchAgent:
    """Specialist agent for architectural planning and research."""

    def __init__(self, planner: RecursivePlanner):
        self.planner = planner

    def execute(self, objective) -> UACPPayload:
        """Executes a research task using the recursive planning engine."""
        start_time = time.time()
        sub_tasks = self.planner.decompose(objective)
        merged_plan = "\n".join([f"- {st}" for st in sub_tasks])
        
        return UACPPayload(
            agent="research",
            analysis="Generated recursive task decomposition and research notes.",
            output=merged_plan,
            confidence=0.85,
            requires_revision=False, # Critic will decide
            notes_for_memory="Research planning completed.",
            execution_time_ms=int((time.time() - start_time) * 1000)
        )
