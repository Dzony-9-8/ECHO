import uuid
from typing import List, Dict, Any
from swarm.protocol import AgentType, AgentTask, TaskStatus, SwarmPacket
from swarm.agent import BaseAgent
from swarm.specialists import DevAgent, ResearchAgent
from swarm.critic import CriticAgent
from intelligence.interface import IntelligenceLayer

class Supervisor(BaseAgent):
    """The central orchestrator for the Project ECHO swarm."""

    def __init__(self, intelligence: IntelligenceLayer, llm, repo_path: str):
        super().__init__(AgentType.SUPERVISOR, intelligence)
        self.llm = llm
        self.repo_path = repo_path
        
        # Initialize specialists
        self.specialists: Dict[AgentType, BaseAgent] = {
            AgentType.DEVELOPER: DevAgent(intelligence, repo_path),
            AgentType.RESEARCHER: ResearchAgent(intelligence, llm, intelligence.semantic.embedder),
            AgentType.CRITIC: CriticAgent(intelligence, llm)
        }
        
        self.max_iterations = 3

    async def execute_task(self, task: AgentTask) -> AgentTask:
        """The Supervisor's main reasoning loop."""
        objective = task.description
        task.reasoning_trace.append(f"Supervisor analyzing objective: {objective}")
        
        iteration = 0
        final_results = []
        
        while iteration < self.max_iterations:
            iteration += 1
            task.reasoning_trace.append(f"Iteration {iteration}/{self.max_iterations} started.")
            
            # 1. Ask LLM to decompose or decide next step
            # For now, we use a heuristic or a simplified LLM prompt
            # In a full implementation, we'd call self.llm.completion()
            
            # MOCKING DECOMPOSITION LOGIC FOR NOW (to be replaced with actual LLM calls)
            # Supervisor decides: "Research first, then Dev"
            
            if iteration == 1:
                # Step 1: Research
                research_task = AgentTask(
                    task_id=f"research-{uuid.uuid4().hex[:4]}",
                    description=f"Analyze and plan: {objective}",
                    assigned_to=AgentType.RESEARCHER
                )
                research_result = await self.specialists[AgentType.RESEARCHER].run(research_task)
                final_results.append(f"RESEARCH INSIGHTS:\n{research_result.result}")
                task.reasoning_trace.append("Research phase completed.")
                
            else:
                # Step 2: Development / Refinement
                current_description = f"Implement based on research and feedback: {objective}"
                if final_results and "CRITIQUE" in final_results[-1]:
                    current_description += f"\n\nPRIOR FEEDBACK: {final_results[-1]}"
                
                dev_task = AgentTask(
                    task_id=f"dev-{uuid.uuid4().hex[:4]}",
                    description=current_description,
                    assigned_to=AgentType.DEVELOPER,
                    payload={"task_type": "coding"}
                )
                dev_result = await self.specialists[AgentType.DEVELOPER].run(dev_task)
                
                # Step 3: Critique
                critic_task = AgentTask(
                    task_id=f"critic-{uuid.uuid4().hex[:4]}",
                    description=f"Evaluate result for: {objective}",
                    assigned_to=AgentType.CRITIC,
                    payload={"output_to_critique": dev_result.result}
                )
                critic_result = await self.specialists[AgentType.CRITIC].run(critic_task)
                
                if critic_result.status == TaskStatus.REVISION_REQUESTED:
                    task.reasoning_trace.append(f"Critic requested revision: {critic_result.result}")
                    final_results.append(f"CRITIQUE (REVISION NEEDED):\n{critic_result.result}")
                    # Continue loop to try revision
                    continue
                else:
                    final_results.append(f"DEV PLAN (APPROVED):\n{dev_result.result}")
                    task.reasoning_trace.append("Development planning passed critique.")
                    break # Successful completion
            
        task.result = "\n\n".join(final_results)
        task.status = TaskStatus.COMPLETED
        return task

    async def coordinate(self, objective: str) -> str:
        """High-level entry point for the orchestrator."""
        main_task = AgentTask(
            task_id=f"main-{uuid.uuid4().hex[:4]}",
            description=objective,
            assigned_to=AgentType.SUPERVISOR
        )
        
        completed_task = await self.run(main_task)
        return f"--- SWARM EXECUTION COMPLETE ---\n\n{completed_task.result}"
