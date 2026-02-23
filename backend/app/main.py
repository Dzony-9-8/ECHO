"""
ECHO V4 — Application Entry Point (backend/app/main.py)
Clean FastAPI factory using the new V4 split-router structure.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import APP_TITLE, APP_VERSION, ECHO_MODE
from .core.logging import logger
from .api.routes_chat   import router as chat_router
from .api.routes_tools  import router as tools_router
from .api.routes_health import router as health_router


def create_app() -> FastAPI:
    app = FastAPI(
        title=APP_TITLE,
        version=APP_VERSION,
        description="ECHO AI — Local Modular Assistant",
        docs_url="/docs",
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # All routes live under /v1 to stay OpenAI-compatible
    app.include_router(chat_router,   prefix="/v1", tags=["Chat"])
    app.include_router(tools_router,  prefix="/v1", tags=["Tools"])
    app.include_router(health_router, tags=["Health"])

    @app.on_event("startup")
    async def _startup():
        logger.info(f"ECHO {APP_VERSION} starting in {ECHO_MODE.upper()} mode")

    return app


app = create_app()
