"""
ECHO V4 — Tools / Insights Routes (backend/app/api/routes_tools.py)
Exposes insight metadata and direct tool invocation endpoints.
"""
from fastapi import APIRouter, Depends
from ..core.security import verify_api_key

router = APIRouter(dependencies=[Depends(verify_api_key)])


@router.get("/insights/latest")
def get_latest_insight():
    return {
        "status": "success",
        "insight": {
            "rag_matches":      "Matched 2 chunks from offline vector db",
            "web_sources":      "DuckDuckGo: 3 articles used",
            "research_rounds":  1,
            "branch_count":     0,
            "confidence_score": "High (0.89)"
        }
    }


@router.get("/insights/session/{session_id}")
def get_session_insight(session_id: str):
    return get_latest_insight()
