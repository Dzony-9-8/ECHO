"""
ECHO V4 — Health Route (backend/app/api/routes_health.py)
Returns system status, version, and resource profile.
"""
from fastapi import APIRouter
from ..core.config import APP_VERSION, ECHO_MODE
from ..core.system_monitor import system_monitor

router = APIRouter()


@router.get("/health")
def health_check():
    stats = system_monitor.get_stats()
    return {
        "status":           "ok",
        "version":          APP_VERSION,
        "mode":             ECHO_MODE,
        "resource_profile": stats.get("profile", "balanced"),
        "cpu_percent":      stats.get("cpu_percent"),
        "ram_available_gb": stats.get("ram_available_gb"),
    }
