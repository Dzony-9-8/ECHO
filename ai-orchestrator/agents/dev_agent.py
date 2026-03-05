from developer.core import DeveloperCore
from agents.protocol import UACPPayload
import time

class DevAgent:
    """Specialist agent for code implementation and refactoring."""

    def __init__(self, dev_core: DeveloperCore):
        self.dev_core = dev_core

    def execute(self, objective) -> UACPPayload:
        """Executes a development task using the core implementation engine."""
        start_time = time.time()
        # Mapping to DeveloperCore's intelligent planning
        analysis = {"task_type": "coding"}
        plan_meta = self.dev_core.intelligent_plan(objective, analysis, local_model=True)
        
        return UACPPayload(
            agent="dev",
            analysis=f"Drafted implementation plan using {plan_meta['selected_model']}.",
            output=plan_meta['draft_plan'],
            confidence=plan_meta['confidence'],
            requires_revision=False, # Critic will decide
            notes_for_memory=f"Dev execution successful via {plan_meta['selected_model']}",
            execution_time_ms=int((time.time() - start_time) * 1000),
            metadata={"routing_id": plan_meta.get("routing_id")}
        )
