class DevPlanner:
    def create_plan(self, objective, target_files, impact_analyzer=None):
        """Generates a structured plan for complex developer tasks with risk assessment."""
        print(f"--- Developer Profile: Generating plan for {objective} ---")
        
        risks = []
        if impact_analyzer:
            for f in target_files:
                impact = impact_analyzer.analyze(f)
                if impact["risk_score"] > 0.3:
                    risks.append({
                        "file": f,
                        "risk": impact["risk_level"],
                        "score": impact["risk_score"],
                        "affected": impact["impacted_files_count"]
                    })

        return {
            "objective": objective,
            "steps": [
                "Analyze target files",
                "Determine required modifications",
                "Generate patch",
                "Run tests",
                "Evaluate results"
            ],
            "target_files": target_files,
            "risk_assessment": risks or "LOW"
        }
