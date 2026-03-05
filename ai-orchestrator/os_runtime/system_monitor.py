import psutil
import time
from intelligence.interface import IntelligenceLayer

class SystemMonitor:
    def __init__(self):
        self.stats = {}
        self.intelligence = IntelligenceLayer()

    def get_metrics(self):
        """Captures current system performance metrics."""
        cpu = psutil.cpu_percent(interval=1)
        mem = psutil.virtual_memory().percent
        gpu = False # Placeholder
        
        self.stats = {
            "cpu_percent": cpu,
            "memory_percent": mem,
            "gpu_found": gpu
        }
        
        # Unified Memory Integration
        self.intelligence.record_system_metrics(cpu, mem, gpu)
        
        print(f"--- OS Profile: System Metrics: {self.stats} ---")
        return self.stats
