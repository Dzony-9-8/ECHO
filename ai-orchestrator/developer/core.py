import os
from developer.complexity_analyzer import ComplexityAnalyzer
from developer.confidence_estimator import ConfidenceEstimator
from developer.adaptive_router import AdaptiveRouter
from developer.performance_monitor import PerformanceMonitor
from developer.cost_tracker import CostTracker
from intelligence.interface import IntelligenceLayer

class DeveloperCore:
    def __init__(self, repo_path):
        from developer.repo_indexer import RepoIndexer
        from developer.dependency_graph import DependencyGraph
        from developer.embedding_index import EmbeddingIndex
        from developer.git_manager import GitManager
        from developer.test_runner import TestRunner
        from developer.planner import DevPlanner
        from developer.refactor_agent import RefactorAgent
        from developer.patch_generator import PatchGenerator
        from developer.impact_analyzer import ImpactAnalyzer

        self.repo_path = repo_path
        self.indexer = RepoIndexer(repo_path)
        self.graph = DependencyGraph()
        self.git = GitManager()
        self.tests = TestRunner(repo_path)
        self.planner = DevPlanner()
        self.refactor = RefactorAgent()
        self.patch_gen = PatchGenerator()
        self.impact = ImpactAnalyzer(self)
        
        # Final Intelligence Stack (Phase 20)
        self.complexity = ComplexityAnalyzer()
        self.confidence = ConfidenceEstimator()
        
        # Unified Intelligence (Phase 25 Abstraction)
        self.intelligence = IntelligenceLayer()

        # Advanced Routing & Monitoring (Phase 21)
        self.router = AdaptiveRouter(self.intelligence)
        self.performance = PerformanceMonitor()
        self.costs = CostTracker()
        
        # Embedder will be injected/initialized manually if needed
        self.embedding_index = None 
        self.file_map = None
        self.dep_graph = None

    def initialize(self):
        """Standard bootstrap for the repo."""
        self.file_map = self.indexer.index()
        self.dep_graph = self.graph.build(self.file_map)
        return self.file_map

    def predict_impact(self, file_path):
        """Calculates risk and affected files for a given target."""
        return self.impact.analyze(file_path)

    def set_embedder(self, embedder):
        from developer.embedding_index import EmbeddingIndex
        self.embedding_index = EmbeddingIndex(embedder)
        self.intelligence.set_embedder(embedder)

    def plan_change(self, objective):
        """Generates a structured implementation plan."""
        context_files = list(self.file_map.keys()) if self.file_map else []
        return self.planner.create_plan(objective, context_files, self.impact)

    def intelligent_plan(self, objective, analysis, local_model):
        """
        Specialized reasoning loop for the Developer component.
        """
        complexity_score = self.complexity.score(analysis)
        system_load = self.performance.get_system_load()
        task_type = analysis.get("task_type", "unknown")

        # Ask local model to generate draft plan
        if hasattr(local_model, "generate_plan"):
            draft_plan = local_model.generate_plan(objective)
        elif hasattr(local_model, "run"):
            prompt = f"Create a detailed implementation plan for: {objective}. \nIMPORTANT: Include 'CONFIDENCE: X.XX' at the end."
            draft_plan = local_model.run(prompt)
        else:
            draft_plan = str(local_model(f"Plan: {objective} \nCONFIDENCE: 0.8"))

        confidence_score = self.confidence.extract_confidence(draft_plan)

        selected_model = self.router.route(
            complexity_score,
            confidence_score,
            task_type=task_type,
            system_load=system_load
        )
        
        # Record trace in structured memory
        routing_id = self.intelligence.record_dev_outcome(
            task_type=task_type,
            complexity=complexity_score,
            confidence=confidence_score,
            model=selected_model,
            success=None # Pending
        )
        
        # Record trace in semantic memory
        self.intelligence.store_research_conclusion(
            text=f"Objective: {objective}\nDraft Plan: {draft_plan}",
            meta={
                "objective": objective,
                "complexity": complexity_score,
                "confidence": confidence_score,
                "selected_model": selected_model,
                "routing_id": routing_id
            }
        )

        return {
            "routing_id": routing_id,
            "complexity": complexity_score,
            "confidence": confidence_score,
            "selected_model": selected_model,
            "draft_plan": draft_plan,
            "system_load": system_load
        }

    def record_task_outcome(self, routing_id, objective, success):
        """Updates the outcome in unified memory for adaptive learning."""
        # 1. Update structured memory
        self.intelligence.record_dev_outcome(
            task_type=None, complexity=None, confidence=None, model=None, 
            success=success, routing_id=routing_id
        )
        
        # 2. Update router's internal state
        cursor = self.intelligence.structured.conn.cursor()
        cursor.execute("SELECT complexity, confidence, task_type FROM routing_history WHERE id = ?", (routing_id,))
        if row := cursor.fetchone():
            self.router.record_outcome(
                row["complexity"], row["confidence"], success, task_type=row["task_type"]
            )

    def apply_patch(self, file_path, original_content, new_content):
        """Direct file write - wrap this with verification in layers above."""
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            return True
        except Exception as e:
            print(f"--- Error applying patch to {file_path}: {e} ---")
            return False

    def run_suite(self):
        """Run all tests."""
        return self.tests.run_tests()
