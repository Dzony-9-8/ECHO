from typing import Dict, Any
from agents.protocol import UACPPayload, MemoryIntelligence
from agents.loop_controller import LoopController
from agents.supervisor import SupervisorAgent
import uuid
import time

class AgentManager:
    """Central orchestrator for structured multi-agent coordination (UACP)."""

    def __init__(self, dev_agent, research_agent, critic_agent, memory):
        self.dev_agent = dev_agent
        self.research_agent = research_agent
        self.critic_agent = critic_agent
        self.supervisor = SupervisorAgent(memory)
        self.loop = LoopController(max_iterations=3)
        self.memory = memory

    def run(self, objective: str) -> Dict[str, Any]:
        """Main execution loop enforcing UACP and safety rules."""
        print(f"--- AgentManager: Starting Objective: {objective} ---")
        
        # Step 1: Supervisor decides the path
        role = self.supervisor.decide(objective)
        specialist = self.dev_agent if role == "dev" else self.research_agent
        
        iteration = 0
        while iteration < self.loop.max_iterations:
            iteration += 1
            print(f"--- AgentManager: Cycle {iteration} (Role: {role}) ---")
            
            # Specialist Execution
            payload: UACPPayload = specialist.execute(objective)
            
            # Critic Evaluation
            critique: UACPPayload = self.critic_agent.evaluate(payload.to_dict())
            
            # Loop Controller Decision
            decision = self.loop.decide_iteration(iteration, critique.confidence)
            
            print(f"--- AgentManager: Critic Confidence: {critique.confidence} -> Decision: {decision} ---")

            if decision == "finalize":
                self._write_memory(payload, success=True)
                return payload.to_dict()
            
            if decision == "escalate":
                print("--- AgentManager: ESCALATING to Heavy Model ---")
                payload.metadata["escalated"] = True
                self._write_memory(payload, success=True, tags=["escalated"])
                return payload.to_dict()

            if decision == "stop":
                print("--- AgentManager: Stop Requested (Max Iterations or Low Confidence) ---")
                self._write_memory(payload, success=False, failure_type="max_iterations")
                return payload.to_dict()

            # Retry Logic (implied if we reach here and decision was 'retry')
            objective = f"REVISION REQUESTED: {critique.analysis}\nOriginal Objective: {objective}"

        return payload.to_dict()

    def _write_memory(self, payload: UACPPayload, success: bool, failure_type=None, tags=None):
        """Writes compressed intelligence to shared memory."""
        intel = MemoryIntelligence(
            task_signature=uuid.uuid4().hex[:8], # Proxy for real hash
            agent_used=payload.agent,
            confidence=payload.confidence,
            success=success,
            failure_type=failure_type,
            time_ms=payload.execution_time_ms,
            tags=tags or []
        )
        self.memory.record_agent_memory(intel.to_dict())
        print(f"--- AgentManager: Memory Written: {intel.agent_used} (Success: {success}) ---")
