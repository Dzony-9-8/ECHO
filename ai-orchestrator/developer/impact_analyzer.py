class ImpactAnalyzer:
    """Calculates risk and blast radius of code modifications."""

    def __init__(self, core):
        self.core = core

    def analyze(self, target_file):
        """
        Calculates a Risk Score and identifies affected files.
        """
        # Ensure graph is fresh
        file_map = self.core.indexer.index()
        graph_data = self.core.graph.build(file_map)
        
        impacted_files = self.core.graph.find_transitive_impact(target_file)
        
        # Risk Scoring Logic
        # 1. Total count of affected files
        # 2. Depth/Breadth of impact
        # 3. Criticality of the file (how many things import it directly)
        
        direct_dependents = len(graph_data["reverse"].get(target_file, []))
        total_impact = len(impacted_files)
        
        # Simple Risk Calculation 0.0 - 1.0
        # 0.1 per impacted file, capped at 0.5
        # 0.1 per direct dependent, capped at 0.4
        risk_score = min(0.5, total_impact * 0.05) + min(0.4, direct_dependents * 0.1)
        
        # Baseline risk for any change
        risk_score = max(0.1, risk_score)

        risk_level = "LOW"
        if risk_score > 0.7:
            risk_level = "CRITICAL"
        elif risk_score > 0.4:
            risk_level = "MEDIUM"
        elif risk_score > 0.2:
            risk_level = "LOW-MEDIUM"

        return {
            "target_file": target_file,
            "risk_score": round(risk_score, 2),
            "risk_level": risk_level,
            "impacted_files_count": total_impact,
            "impacted_files": impacted_files,
            "direct_dependents_count": direct_dependents
        }
