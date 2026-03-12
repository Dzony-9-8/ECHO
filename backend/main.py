"""
ECHO V4 — Backend Entry Point (backend/main.py)
Delegates to the clean V4 FastAPI factory in backend/app/main.py.
Legacy compatibility shim — preserves `uvicorn backend.main:app`.
"""
from backend.app.main import app  # noqa: F401 — re-export for uvicorn
