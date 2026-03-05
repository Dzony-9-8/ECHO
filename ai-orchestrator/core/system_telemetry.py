import psutil
import logging

try:
    import pynvml
    NVIDIA_GPU_AVAILABLE = True
except ImportError:
    NVIDIA_GPU_AVAILABLE = False

class SystemTelemetry:
    """Monitors system resources like VRAM, RAM, and CPU."""

    def __init__(self):
        self.logger = logging.getLogger("SystemTelemetry")
        if NVIDIA_GPU_AVAILABLE:
            try:
                pynvml.nvmlInit()
            except Exception as e:
                self.logger.warning(f"NVML failed to initialize: {e}")
                self.nvidia_available = False
            else:
                self.nvidia_available = True
        else:
            self.nvidia_available = False

    def get_stats(self):
        """Returns current resource utilization stats."""
        return {
            "cpu_percent": psutil.cpu_percent(interval=None),
            "ram": self._get_ram_stats(),
            "gpu": self._get_gpu_stats()
        }

    def _get_ram_stats(self):
        ram = psutil.virtual_memory()
        return {
            "total_gb": round(ram.total / (1024**3), 2),
            "available_gb": round(ram.available / (1024**3), 2),
            "used_percent": ram.percent
        }

    def _get_gpu_stats(self):
        if not self.nvidia_available:
            return None

        try:
            device_count = pynvml.nvmlDeviceGetCount()
            gpus = []
            for i in range(device_count):
                handle = pynvml.nvmlDeviceGetHandleByIndex(i)
                info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                gpus.append({
                    "id": i,
                    "name": pynvml.nvmlDeviceGetName(handle),
                    "vram_total_gb": round(info.total / (1024**3), 2),
                    "vram_used_gb": round(info.used / (1024**3), 2),
                    "vram_percent": round((info.used / info.total) * 100, 2),
                    "load_percent": util.gpu
                })
            return gpus
        except Exception as e:
            self.logger.error(f"Error reading GPU stats: {e}")
            return None

    def check_vram_threshold(self, required_gb):
        """Checks if enough VRAM is available for a new model."""
        gpu_stats = self._get_gpu_stats()
        if not gpu_stats:
            return True # Assume OK if no GPU (running on CPU)

        # Use the GPU with the most free VRAM
        max_free = max(g["vram_total_gb"] - g["vram_used_gb"] for g in gpu_stats)
        return max_free >= required_gb

    def __del__(self):
        if self.nvidia_available:
            try:
                pynvml.nvmlShutdown()
            except:
                pass
