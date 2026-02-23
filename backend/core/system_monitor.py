"""
ECHO V3 — System Monitor
Detects available RAM and CPU load to return a resource profile.
Profile is passed through the orchestrator to allow adaptive behavior.
"""

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

class SystemMonitor:
    """
    Returns a resource profile based on current RAM + CPU:
      'low'       — under pressure, reduce context / token limits
      'balanced'  — normal operation
      'high'      — plenty of resources, allow deeper research
    """

    def get_profile(self) -> str:
        if not PSUTIL_AVAILABLE:
            return "balanced"  # Safe default if psutil not installed

        try:
            ram = psutil.virtual_memory()
            cpu  = psutil.cpu_percent(interval=0.1)
            available_gb = ram.available / (1024 ** 3)

            if available_gb < 2.0 or cpu > 85:
                return "low"
            elif available_gb > 6.0 and cpu < 40:
                return "high"
            else:
                return "balanced"
        except Exception:
            return "balanced"

    def get_stats(self) -> dict:
        """Returns raw stats for logging/debugging."""
        if not PSUTIL_AVAILABLE:
            return {"psutil": "not installed"}
        try:
            ram = psutil.virtual_memory()
            return {
                "cpu_percent": psutil.cpu_percent(interval=0.1),
                "ram_available_gb": round(ram.available / (1024 ** 3), 2),
                "ram_used_percent": ram.percent,
                "profile": self.get_profile()
            }
        except Exception as e:
            return {"error": str(e)}

system_monitor = SystemMonitor()
