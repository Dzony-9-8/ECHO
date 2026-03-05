class CrossFeedbackEngine:

    def __init__(self, intelligence_layer):
        self.intel = intelligence_layer

    def analyze_dev_failures(self):
        """
        Research-tier analysis of Developer component performance.
        Returns suggestions for architectural improvements.
        """
        # 1. Fetch recent history from structured memory
        history = self.intel.structured.get_recent_routing_history(limit=50)
        
        # 2. Heuristic Analysis
        failures = [h for h in history if h["success"] == 0] # mapping success=0
        if not failures:
            return "System performance is optimal. No architectural changes recommended."

        # 3. Simple cluster logic (can be expanded with LLM)
        type_failures = {}
        for h in failures:
            t_type = h["task_type"]
            type_failures[t_type] = type_failures.get(t_type, 0) + 1

        top_failure_type = max(type_failures, key=type_failures.get)
        
        if type_failures[top_failure_type] > 5:
            return f"CRITICAL: High failure rate detected in '{top_failure_type}' tasks. Suggesting specialized specialist agent for this domain."
            
        return "Stable performance. Monitoring failure clusters."

    def suggest_threshold_adjustment(self):
        """Suggests optimal confidence/complexity thresholds based on cost vs success."""
        # Future: Analyze token cost vs success rate to optimize for ROI
        return {"confidence_threshold_shift": 0.0, "reason": "Data pool insufficient for ROI analysis."}
