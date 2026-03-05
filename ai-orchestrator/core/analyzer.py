import logging
from typing import Dict, List, Any

class TaskAnalyzer:
    """Classifies tasks and computes complexity scores."""

    def __init__(self, dependency_graph=None):
        self.logger = logging.getLogger("TaskAnalyzer")
        self.dependency_graph = dependency_graph

    def analyze(self, task_description: str, files_involved: List[str]) -> Dict[str, Any]:
        """
        Classifies the task and computes a complexity score.
        """
        # 1. Classification
        classification = self._classify_task(task_description, files_involved)
        
        # 2. Complexity Scoring
        file_count = len(files_involved)
        dependency_depth = self._get_dependency_depth(files_involved)
        reasoning_steps = self._estimate_reasoning_steps(classification, file_count)
        
        complexity_score = (
            file_count * 2 +
            dependency_depth * 3 +
            reasoning_steps * 4
        )
        
        analysis = {
            "classification": classification,
            "complexity_score": complexity_score,
            "file_count": file_count,
            "dependency_depth": dependency_depth,
            "reasoning_steps": reasoning_steps
        }
        
        self.logger.info(f"Task Analysis: {analysis}")
        return analysis

    def _classify_task(self, description: str, files: List[str]) -> str:
        desc = description.lower()
        if len(files) <= 1:
            if "refactor" in desc: return "single_file_refactor"
            return "simple_code_edit"
        
        if "architecture" in desc or "design" in desc:
            return "architecture_change"
        
        if len(files) > 3 or "refactor" in desc:
            return "multi_file_refactor"
        
        if "?" in desc or "how" in desc:
            return "research_question"
            
        return "multi_file_refactor"

    def _get_dependency_depth(self, files: List[str]) -> int:
        if not self.dependency_graph:
            return 1
        
        max_depth = 0
        for f in files:
            # Simple depth estimation via transitive lookup
            impact = self.dependency_graph.find_transitive_impact(f)
            depth = len(impact.get("impacted_files", []))
            if depth > max_depth:
                max_depth = depth
        return min(max_depth, 5) # Cap depth impact for scoring

    def _estimate_reasoning_steps(self, classification: str, file_count: int) -> int:
        base_steps = {
            "simple_code_edit": 1,
            "single_file_refactor": 2,
            "multi_file_refactor": 3,
            "architecture_change": 5,
            "research_question": 2,
            "creative_generation": 2
        }
        return base_steps.get(classification, 2) + (file_count // 2)
