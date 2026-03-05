import json
import os
import threading

class HeuristicsManager:
    """Manages persistent system heuristics and thresholds in cache.json."""

    def __init__(self, cache_path="intelligence/cache.json"):
        self.cache_path = cache_path
        self._lock = threading.Lock()
        self.defaults = {
            "confidence_threshold": 0.72,
            "complexity_threshold": 8,
            "last_failure_rate": 0.0
        }
        self._ensure_cache()

    def load(self):
        """Loads heuristics from the JSON cache with default fallback."""
        import contextlib
        with self._lock:
            if os.path.exists(self.cache_path):
                with contextlib.suppress(json.JSONDecodeError, IOError):
                    with open(self.cache_path, "r") as f:
                        return json.load(f)
            return self.defaults.copy()

    def _ensure_cache(self):
        """Ensures the cache file exists with valid defaults."""
        if not os.path.exists(self.cache_path):
            os.makedirs(os.path.dirname(self.cache_path), exist_ok=True)
            self.save(self.defaults)

    def save(self, data):
        """Atomically saves heuristics to the JSON cache."""
        with self._lock:
            temp_path = f"{self.cache_path}.tmp"
            try:
                with open(temp_path, "w") as f:
                    json.dump(data, f, indent=2)
                os.replace(temp_path, self.cache_path)
                return True
            except IOError:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                return False

    def update_thresholds(self, confidence=None, complexity=None):
        """Safely updates specific threshold values."""
        current = self.load()
        if confidence is not None:
            current["confidence_threshold"] = confidence
        if complexity is not None:
            current["complexity_threshold"] = complexity
        self.save(current)
