from intelligence.memory_manager import MemoryManager
from intelligence.vector_memory import VectorMemory
from intelligence.cross_feedback import CrossFeedbackEngine
from intelligence.heuristics import HeuristicsManager
from intelligence.sentinel import Sentinel

class IntelligenceLayer:

    def __init__(self, embedder=None):
        self.structured = MemoryManager()
        self.semantic = VectorMemory(embedder)
        self.feedback = CrossFeedbackEngine(self)
        self.heuristics = HeuristicsManager()
        self.sentinel = Sentinel(self)

    def set_embedder(self, embedder):
        """Dynamic embedder injection."""
        self.semantic.embedder = embedder

    # ---- Developer Hooks ----
    def record_dev_outcome(self, task_type, complexity, confidence, model, success, routing_id=None):
        """Logs developer-specific routing and performance data."""
        if routing_id:
            self.structured.update_routing_success(routing_id, success)
        else:
            return self.structured.record_routing(
                task_type, complexity, confidence, model, success
            )

    # ---- Research Hooks ----
    def store_research_conclusion(self, text, meta):
        """Persists research insights and logic clusters."""
        return self.semantic.add(text, meta)

    def search_past_insight(self, query, top_k=5):
        """Retrieves semantically similar reasoning patterns."""
        return self.semantic.search(query, top_k)

    def record_agent_memory(self, intel: dict):
        """Logs compressed swarm intelligence (UACP)."""
        return self.structured.record_agent_memory(intel)

    # ---- System Hooks ----
    def record_system_metrics(self, cpu, mem, gpu):
        """Logs long-term performance telemetry."""
        self.structured.record_performance(cpu, mem, gpu)

    def analyze_performance(self):
        """Triggers the cross-feedback loop to analyze failures."""
        return self.feedback.analyze_dev_failures()

    def get_heuristics(self):
        """Loads persistent thresholds from cache."""
        return self.heuristics.load()

    def persist_thresholds(self, confidence=None, complexity=None):
        """Saves learned thresholds to disk."""
        self.heuristics.update_thresholds(confidence, complexity)

    def optimize_system(self):
        """Triggers the Sentinel optimization loop."""
        return self.sentinel.run_nightly_optimization()

    def check_health(self):
        """Returns complex system health metrics."""
        return self.sentinel.get_system_health()
