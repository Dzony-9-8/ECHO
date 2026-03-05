class ComplexityAnalyzer:

    def score(self, analysis):
        file_count = analysis.get("file_count", 1)
        dependency_depth = analysis.get("dependency_depth", 1)
        reasoning_steps = analysis.get("reasoning_steps", 1)

        return (
            file_count * 2 +
            dependency_depth * 3 +
            reasoning_steps * 4
        )
