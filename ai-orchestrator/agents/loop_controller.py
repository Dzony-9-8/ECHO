class LoopController:
    """Safety and iteration logic for agent loops."""

    def __init__(self, max_iterations=3):
        self.max_iterations = max_iterations

    def allow(self, iteration):
        """Standard hard cap on iterations."""
        return iteration < self.max_iterations

    def decide_iteration(self, iteration, confidence) -> str:
        """
        Decides the next action based on iteration count and confidence.
        Returns: 'finalize' | 'retry' | 'escalate' | 'stop'
        """
        if confidence >= 0.85:
            return "finalize"
        
        if iteration >= self.max_iterations:
            return "stop"

        if confidence < 0.6:
            # If after 1 retry confidence is still low, escalate
            return "escalate" if iteration >= 1 else "retry"

        return "retry"
