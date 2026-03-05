import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List
from intelligence.memory_manager import MemoryManager
from intelligence.heuristics import HeuristicsManager

class Sentinel:
    """Proactive maintenance and heuristic optimization engine."""

    def __init__(self, intelligence_layer):
        self.intel = intelligence_layer
        self.logger = logging.getLogger("echo.sentinel")

    def run_nightly_optimization(self) -> Dict[str, Any]:
        """Scans routing history and applies self-tuning logic."""
        self.logger.info("Sentinel: Starting nightly optimization scan...")
        
        report = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "optimizations_applied": [],
            "health_score": 100
        }

        # 1. Analyze Routing Failures
        history = self.intel.structured.get_recent_routing_history(limit=100)
        if not history:
            report["status"] = "No history to analyze."
            return report

        total = len(history)
        failures = [h for h in history if h["success"] == 0]
        failure_rate = len(failures) / total if total > 0 else 0
        
        report["failure_rate"] = failure_rate
        
        # 2. Heuristic Calibration
        if failure_rate > 0.15: # 15% threshold for global concern
            # If failing too much, we likely need higher confidence requirements
            current = self.intel.get_heuristics()
            new_conf = min(1.0, current.get("confidence_threshold", 0.72) + 0.05)
            
            self.intel.persist_thresholds(confidence=new_conf)
            report["optimizations_applied"].append(f"Increased confidence threshold to {new_conf:.2f}")
            report["health_score"] -= 20
            
        # 3. Cluster Analysis (Local model vs API escalation)
        # We look for clusters where local models fail repeatedly
        hotspots = {}
        for h in failures:
            t_type = h["task_type"]
            hotspots[t_type] = hotspots.get(t_type, 0) + 1
            
        for t_type, count in hotspots.items():
            if count > 5: # Specific hotspot detected
                report["optimizations_applied"].append(f"Detected instability in '{t_type}'. Recommending stricter escalation.")

        # 4. Semantic Memory Maintenance (Mocked for now)
        # In a real vector DB, we'd trigger consolidation/compaction
        report["memory_status"] = "Healthy"
        
        self.logger.info(f"Sentinel: Optimization complete. Health Score: {report['health_score']}")
        return report

    def get_system_health(self) -> Dict[str, Any]:
        """Quickly assesses current system performance."""
        history = self.intel.structured.get_recent_routing_history(limit=50)
        failures = [h for h in history if h["success"] == 0]
        
        return {
            "recent_success_rate": 1.0 - (len(failures) / len(history)) if history else 1.0,
            "sample_size": len(history)
        }
