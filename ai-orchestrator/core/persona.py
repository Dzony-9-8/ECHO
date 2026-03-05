"""Unified persona injector — single source of truth for tone and rules."""
import yaml
from pathlib import Path


class Persona:
    def __init__(self, path: str | None = None):
        if path is None:
            path = Path(__file__).resolve().parent.parent / "config" / "persona.yaml"
        with open(path, "r", encoding="utf-8") as f:
            self.data = yaml.safe_load(f)

    def apply(self) -> str:
        rules = "\n- ".join(self.data["rules"])
        return f"""
Persona:
Tone: {self.data['tone']}
Verbosity: {self.data['verbosity']}
Rules:
- {rules}
"""
