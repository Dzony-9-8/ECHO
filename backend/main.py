"""
ECHO Local Backend — FastAPI server for real system metrics and local AI inference.

Install dependencies:
    pip install fastapi uvicorn psutil gputil

Run:
    uvicorn main:app --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import psutil
import platform
import socket
import time

app = FastAPI(title="ECHO Local Backend")

# Allow CORS from the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

START_TIME = time.time()


def get_gpu_info() -> dict | None:
    """Try to get GPU info via GPUtil. Returns None if no GPU or library missing."""
    try:
        import GPUtil
        gpus = GPUtil.getGPUs()
        if not gpus:
            return None
        gpu = gpus[0]
        return {
            "name": gpu.name,
            "vram_total_mb": int(gpu.memoryTotal),
            "vram_used_mb": int(gpu.memoryUsed),
            "gpu_usage_percent": gpu.load * 100,
            "temperature_c": gpu.temperature,
        }
    except (ImportError, Exception):
        return None


@app.get("/api/system")
def system_metrics():
    """
    Returns real-time system metrics in the RealSystemMetrics format
    expected by the ECHO frontend.
    """
    vm = psutil.virtual_memory()

    # CPU temperature
    cpu_temp = None
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            # Try common sensor names
            for key in ("coretemp", "k10temp", "cpu_thermal", "cpu-thermal"):
                if key in temps and temps[key]:
                    cpu_temp = temps[key][0].current
                    break
            # Fallback: first available sensor
            if cpu_temp is None:
                for sensors in temps.values():
                    if sensors:
                        cpu_temp = sensors[0].current
                        break
    except (AttributeError, Exception):
        pass  # sensors_temperatures not available on all platforms

    return {
        "cpu": {
            "name": platform.processor() or platform.machine(),
            "cores": psutil.cpu_count(logical=False) or psutil.cpu_count(),
            "threads": psutil.cpu_count(logical=True),
            "usage_percent": psutil.cpu_percent(interval=0.1),
            "temperature_c": round(cpu_temp, 1) if cpu_temp is not None else None,
        },
        "ram": {
            "total_gb": round(vm.total / (1024 ** 3), 1),
            "used_gb": round(vm.used / (1024 ** 3), 1),
            "usage_percent": vm.percent,
        },
        "gpu": get_gpu_info(),
        "platform": platform.system(),
        "hostname": socket.gethostname(),
    }


@app.get("/api/health")
def health():
    """Health check endpoint for the frontend status indicator."""
    gpu = get_gpu_info()
    return {
        "backend": "online",
        "gpu": {
            "name": gpu["name"],
            "vram_used": gpu["vram_used_mb"],
            "vram_total": gpu["vram_total_mb"],
        } if gpu else None,
        "models_loaded": [],
        "uptime": round(time.time() - START_TIME),
    }
