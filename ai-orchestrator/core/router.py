"""Task router — deterministic execution: calls specialists and agent loop from plan."""
from .planner import Plan


class TaskRouter:
    def __init__(self, reasoning_model, coder_model, agent_loop):
        self.reasoning = reasoning_model
        self.coder = coder_model
        self.agent_loop = agent_loop

    async def execute(self, plan: Plan, user_input: str) -> dict:
        outputs = {}

        if plan.reasoning_required and "deepseek_r1" in plan.models:
            model = self.reasoning() if callable(self.reasoning) else self.reasoning
            # Specialist runs are currently synchronous but wrapped for async loop compatibility
            outputs["reasoning"] = model.run(user_input)

        if plan.coding_required and "deepseek_coder" in plan.models:
            model = self.coder() if callable(self.coder) else self.coder
            outputs["code"] = model.run(user_input)

        if plan.tool_calls:
            outputs["tools"] = await self.agent_loop.run(plan, plan.tool_calls)

        return outputs
