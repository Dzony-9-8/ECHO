class AdaptiveRouter:

    def __init__(self, intelligence=None):
        self.intelligence = intelligence
        
        # Load persistent thresholds if intelligence layer is available
        heuristics = self.intelligence.get_heuristics() if self.intelligence else {}
        self.complexity_threshold = heuristics.get("complexity_threshold", 8)
        self.confidence_threshold = heuristics.get("confidence_threshold", 0.72)
        
        self.history = []
        self.failure_patterns = {
            "multi_file_refactor": 0,
            "architecture_change": 0,
            "simple_code_edit": 0
        }

    def record_outcome(self, complexity, confidence, success, task_type=None):
        self.history.append({
            "complexity": complexity,
            "confidence": confidence,
            "success": success,
            "task_type": task_type
        })
        
        if not success and task_type in self.failure_patterns:
            self.failure_patterns[task_type] += 1
            
        self._adjust_thresholds()

    def _adjust_thresholds(self):
        if len(self.history) < 5:
            return
            
        recent = self.history[-20:]
        failures = [h for h in recent if not h["success"]]

        if len(failures) > 5:
            self.confidence_threshold = min(1.0, self.confidence_threshold + 0.02)
        elif not failures and len(recent) >= 10:
            self.confidence_threshold = max(0.5, self.confidence_threshold - 0.01)

        # Persist the adjusted thresholds
        if self.intelligence:
            self.intelligence.persist_thresholds(
                confidence=self.confidence_threshold,
                complexity=self.complexity_threshold
            )

    def route(self, complexity_score, confidence_score, task_type=None, system_load=0):
        # 1. Performance-Aware check (if system is under heavy load, escalate)
        if system_load > 85:
            return "deepseek_r1_api"

        # 2. Failure Memory check
        if task_type and self.failure_patterns.get(task_type, 0) > 3:
            return "deepseek_r1_api"

        # 3. Standard threshold check
        if complexity_score >= self.complexity_threshold:
            return "deepseek_r1_api"

        if confidence_score < self.confidence_threshold:
            return "deepseek_r1_api"

        return "local_coder"
