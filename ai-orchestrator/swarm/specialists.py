from swarm.agent import BaseAgent
from swarm.protocol import AgentType, AgentTask, TaskStatus
from developer.core import DeveloperCore
from research.recursive_planner import RecursivePlanner
from intelligence.interface import IntelligenceLayer

class DevAgent(BaseAgent):
    """Specialist for code generation and refactoring."""

    def __init__(self, intelligence: IntelligenceLayer, repo_path: str):
        super().__init__(AgentType.DEVELOPER, intelligence)
        self.dev_core = DeveloperCore(repo_path)
        # Inject the shared intelligence layer to ensure consistency
        self.dev_core.intelligence = intelligence

    async def execute_task(self, task: AgentTask) -> AgentTask:
        objective = task.description
        task.reasoning_trace.append(f"Initializing dev task: {objective}")
        
        # 1. Analyze complexity/confidence
        analysis = {"task_type": task.payload.get("task_type", "coding")}
        plan_meta = self.dev_core.intelligent_plan(objective, analysis, local_model=True)
        
        task.reasoning_trace.append(f"Plan generated. Selected Model: {plan_meta['selected_model']}")
        task.reasoning_trace.append(f"Complexity: {plan_meta['complexity']}, Confidence: {plan_meta['confidence']}")
        
        # 2. Store plan in task results for supervisor review
        task.result = f"Model: {plan_meta['selected_model']}\nDraft Plan: {plan_meta['draft_plan']}"
        task.confidence = plan_meta['confidence']
        
        # 3. Add routing info to payload for logging
        task.payload["routing_id"] = plan_meta["routing_id"]
        task.payload["model"] = plan_meta["selected_model"]
        task.payload["complexity"] = plan_meta["complexity"]
        
        return task

class ResearchAgent(BaseAgent):
    """Specialist for architecture analysis and research."""

    def __init__(self, intelligence: IntelligenceLayer, llm, embedder=None):
        super().__init__(AgentType.RESEARCHER, intelligence)
        self.planner = RecursivePlanner(llm, embedder)
        # Sync intelligence
        self.planner.intelligence = intelligence

    async def execute_task(self, task: AgentTask) -> AgentTask:
        objective = task.description
        task.reasoning_trace.append(f"Starting research: {objective}")
        
        # Search past insights first (Semantic Memory)
        if past_insights := self.intel.search_past_insight(objective, top_k=3):
            task.reasoning_trace.append(f"Retrieved {len(past_insights)} historical insights from memory.")
            
        # Perform decomposition
        sub_tasks = self.planner.decompose(objective)
        task.reasoning_trace.append(f"Objective decomposed into: {', '.join(sub_tasks)}")
        
        task.result = "\n".join([f"- {st}" for st in sub_tasks])
        task.confidence = 0.85 # Default research confidence for now
        
        return task
