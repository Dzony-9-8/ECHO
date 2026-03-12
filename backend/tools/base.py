"""
ECHO V3 — Base Tool Class
All tools registered in the orchestrator must implement this interface.
"""

from abc import ABC, abstractmethod

class Tool(ABC):
    name: str = "base_tool"
    description: str = ""

    @abstractmethod
    def execute(self, input_data: dict) -> dict:
        """
        Execute the tool with the given input.
        Returns a dict with at minimum: { "result": ..., "error": None | str }
        """
        raise NotImplementedError
