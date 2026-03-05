"""Verification agent — placeholder for checking task success (tests, syntax, etc.)."""
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from core.planner import Plan


class VerificationAgent:
    def verify(self, plan: "Plan", output: object) -> bool:
        """Verify tool success: check for errors, empty strings, or specific failure markers."""
        if output is None:
            return False
        if isinstance(output, str):
            if output.startswith("Error:") or output.startswith("Exception:"):
                return False
            if not output.strip():
                return False
        return True
