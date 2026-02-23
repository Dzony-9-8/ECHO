"""
ECHO V4 — Orchestrator re-export (backend/app/core/orchestrator.py)
Re-exports the singleton from backend/core so app/api routes resolve correctly.
"""
from backend.core.orchestrator import orchestrator, Orchestrator  # noqa: F401
