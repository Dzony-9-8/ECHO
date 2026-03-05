"""Agent loop — runs tool_calls with optional verification and max iterations."""
from typing import Any
from .executor import ExecutionAgent
from .verifier import VerificationAgent

from core.planner import Plan


class AgentLoop:
    def __init__(self, executor: ExecutionAgent, verifier: VerificationAgent, max_iters: int = 3):
        self.executor = executor
        self.verifier = verifier
        self.max_iters = max_iters

    async def run(self, plan: Plan, tool_calls: list[dict]) -> list[Any]:
        results = []
        for step in tool_calls[: self.max_iters]:
            try:
                result = await self.executor.execute(
                    step["tool"],
                    step.get("args", {}),
                )
            except Exception as e:
                results.append(f"Error: {e}")
                continue
            results.append(result)
            if self.verifier.verify(plan, result):
                break
        return results
