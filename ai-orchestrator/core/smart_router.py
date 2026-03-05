import logging
from typing import Dict, Any

class SmartRouter:
    """Decides between local execution and cloud escalation."""

    def __init__(self, config=None):
        self.logger = logging.getLogger("SmartRouter")
        self.complexity_threshold = 8
        self.confidence_threshold = 0.72

    def route(self, analysis: Dict[str, Any], confidence: float) -> str:
        """
        Determines the routing target.
        Returns: "local_coder" or "deepseek_r1_api"
        """
        complexity = analysis.get("complexity_score", 0)
        
        self.logger.info(f"Routing check: Complexity={complexity}, Confidence={confidence}")

        # Router Logic (Final Form)
        if complexity < self.complexity_threshold:
            self.logger.info("Routing to LOCAL: Low complexity.")
            return "local_coder"

        if confidence < self.confidence_threshold:
            self.logger.info(f"Escalating to CLOUD (DeepSeek-R1): Low confidence ({confidence}).")
            return "deepseek_r1_api"

        self.logger.info("Routing to LOCAL: High confidence despite complexity.")
        return "local_coder"
