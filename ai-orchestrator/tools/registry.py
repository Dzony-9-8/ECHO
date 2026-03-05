"""Tool registry — single source of truth for allowed tools."""
from typing import Callable, Any


class ToolRegistry:
    def __init__(self):
        self.tools: dict[str, dict[str, Any]] = {}

    def register(self, name: str, fn: Callable, description: str) -> None:
        self.tools[name] = {"fn": fn, "description": description, "enabled": True}

    def filter(self, allowed_names: list):
        """Enable only tools in the allowed list."""
        for name in self.tools:
            self.tools[name]["enabled"] = (name in allowed_names)
        print(f"--- Tool Registry: Filtered to {allowed_names} ---")

    def get(self, name: str) -> dict[str, Any] | None:
        tool = self.tools.get(name)
        return tool if tool and tool.get("enabled", True) else None

    def list(self) -> dict[str, str]:
        return {k: v["description"] for k, v in self.tools.items() if v.get("enabled", True)}
