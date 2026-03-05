"""Execution agent — runs tools by name; no LLM, deterministic."""
from typing import Any

from tools.registry import ToolRegistry


class ExecutionAgent:
    def __init__(self, tools: ToolRegistry):
        self.tools = tools

    async def execute(self, tool_name: str, args: dict[str, Any]) -> Any:
        tool = self.tools.get(tool_name)
        if not tool:
            raise ValueError(f"Unknown tool: {tool_name}")
        # Assuming most tools are currently synchronous, we keep the call as is 
        # but the method signature allows for future async tool integration.
        return tool["fn"](**args)
