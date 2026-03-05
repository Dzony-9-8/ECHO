from swarm.agent import BaseAgent
from swarm.protocol import AgentType, AgentTask, TaskStatus
from intelligence.interface import IntelligenceLayer

class CriticAgent(BaseAgent):
    """The quality gatekeeper for the Project ECHO swarm."""

    def __init__(self, intelligence: IntelligenceLayer, llm):
        super().__init__(AgentType.CRITIC, intelligence)
        self.llm = llm

    async def execute_task(self, task: AgentTask) -> AgentTask:
        """Evaluates the work of other agents."""
        output_to_critique = task.payload.get("output_to_critique")
        task.reasoning_trace.append(f"Critiquing output for task: {task.description}")
        
        # MOCKING CRITIQUE LOGIC
        # 1. Ask LLM to evaluate logic and detect gaps
        # In a full implementation, we'd use self.llm.completion()
        
        # Example: Simple heuristic for confidence/length
        hallucination_score = 0.5 if len(output_to_critique) < 50 else 0.1 # Lower is better
            
        task.confidence = 1.0 - hallucination_score
        
        if hallucination_score > 0.4:
            task.status = TaskStatus.REVISION_REQUESTED
            task.result = "REVISE: Output is too vague or lacks sufficient technical depth."
            task.reasoning_trace.append("Hallucination score high. Requesting revision.")
        else:
            task.result = "PASS: Output meets consistency and depth requirements."
            task.reasoning_trace.append("Output passed quality check.")
            
        return task
