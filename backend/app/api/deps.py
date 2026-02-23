"""
ECHO V4 — FastAPI Dependencies (backend/app/api/deps.py)
Common dependency injection helpers available to all routes.
"""
from ..core.orchestrator import orchestrator as _orchestrator


def get_orchestrator():
    """Returns the singleton orchestrator instance."""
    return _orchestrator
