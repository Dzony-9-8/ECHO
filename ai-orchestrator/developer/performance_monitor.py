import psutil

class PerformanceMonitor:
    def get_cpu_load(self):
        return psutil.cpu_percent(interval=0.1)

    def get_memory_usage(self):
        return psutil.virtual_memory().percent
        
    def get_system_load(self):
        # Combined heuristic
        return max(self.get_cpu_load(), self.get_memory_usage())
