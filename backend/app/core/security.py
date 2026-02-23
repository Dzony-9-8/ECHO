"""
ECHO V4 — Security Middleware (backend/app/core/security.py)
Optional API-key gate for portable/server mode. No-op in desktop mode.
"""
from fastapi import Request, HTTPException, status
from .config import ECHO_API_KEY, ECHO_MODE

async def verify_api_key(request: Request):
    """
    FastAPI dependency. If ECHO_API_KEY is set, the request must include:
      Authorization: Bearer <key>
    In desktop mode with no key set, this is a transparent no-op.
    """
    if not ECHO_API_KEY:
        return  # No key configured — allow all

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header."
        )
    provided = auth_header.removeprefix("Bearer ").strip()
    if provided != ECHO_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key."
        )
