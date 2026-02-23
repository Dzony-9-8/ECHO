"""
ECHO V3 — Chess Tool Wrapper
Wraps backend/chess_manager.py behind the standard Tool interface.
"""

from .base import Tool

class ChessTool(Tool):
    name = "chess"
    description = "Provides chess game management and move suggestions."

    def execute(self, input_data: dict) -> dict:
        try:
            from ..chess_manager import ChessManager
            action = input_data.get("action", "status")
            manager = ChessManager()
            result = manager.handle(action, input_data)
            return {"result": result, "error": None}
        except ImportError:
            return {"result": None, "error": "Chess module not available."}
        except Exception as e:
            return {"result": None, "error": str(e)}
