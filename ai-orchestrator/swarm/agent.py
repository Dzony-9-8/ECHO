from abc import ABC, abstractmethod
from typing import Any, Dict, List
from swarm.protocol import AgentType, AgentTask, TaskStatus
from intelligence.interface import IntelligenceLayer

class BaseAgent(ABC):
    """Base abstraction for all swarm specialists."""

    def __init__(self, agent_type: AgentType, intelligence: IntelligenceLayer):
        self.agent_type = agent_type
        self.intel = intelligence
        self.history: List[AgentTask] = []

    @abstractmethod
    async def execute_task(self, task: AgentTask) -> AgentTask:
        """Core execution logic for the specialist."""
        pass

    def log_to_memory(self, task: AgentTask):
        """Persists agent reasoning and outcomes to the shared intelligence layer."""
        if self.agent_type == AgentType.DEVELOPER:
            self.intel.record_dev_outcome(
                task_type=task.payload.get("task_type", "unknown"),
                complexity=task.payload.get("complexity", 0),
                confidence=task.confidence,
                model=task.payload.get("model", "unknown"),
                success=(task.status == TaskStatus.COMPLETED),
                routing_id=task.payload.get("routing_id")
            )
        
        # Log reasoning trace to semantic memory
        trace_text = "\n".join(task.reasoning_trace)
        self.intel.store_research_conclusion(
            text=f"Agent: {self.agent_type.value}\nTask: {task.description}\nTrace: {trace_text}\nResult: {task.result}",
            meta={
                "agent": self.agent_type.value,
                "task_id": task.task_id,
                "status": task.status.value,
                "confidence": task.confidence
            }
        )

    async def run(self, task: AgentTask) -> AgentTask:
        """Manages the task lifecycle for the specialist."""
        task.status = TaskStatus.IN_PROGRESS
        print(f"--- Swarm: {self.agent_type.value} starting task: {task.task_id} ---")
        
        try:
            task = await self.execute_task(task)
            if task.status != TaskStatus.REVISION_REQUESTED:
                task.status = TaskStatus.COMPLETED
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.result = f"Error: {str(e)}"
            print(f"--- Swarm Error: {self.agent_type.value} failed: {e} ---")
        
        self.log_to_memory(task)
        self.history.append(task)
        return task
