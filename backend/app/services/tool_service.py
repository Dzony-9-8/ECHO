"""
ECHO V4 — Tool Service (backend/app/services/tool_service.py)
Façade over the orchestrator tools/ registry.
Lets the API layer invoke any registered tool by name.
"""
from ..core.config import DEFAULT_LOCATION
from ..core.logging import logger


class ToolService:
    def __init__(self, tools: dict):
        self.tools = tools

    def invoke(self, tool_name: str, input_data: dict) -> dict:
        tool = self.tools.get(tool_name)
        if not tool:
            return {"result": None, "error": f"Unknown tool: {tool_name}"}
        try:
            logger.info(f"[ToolService] Invoking tool: {tool_name} with input: {input_data}")
            result = tool.execute(input_data)
            logger.info(f"[ToolService] Tool {tool_name} returned: error={result.get('error')}")
            return result
        except Exception as e:
            logger.error(f"[ToolService] Tool {tool_name} raised exception: {e}")
            return {"result": None, "error": str(e)}
