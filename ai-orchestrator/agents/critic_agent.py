from agents.protocol import UACPPayload
import time

class CriticAgent:
    """Quality gatekeeper for agent specialists."""

    def __init__(self, model):
        self.model = model

    def evaluate(self, agent_output: dict) -> UACPPayload:
        """Evaluates specialist work and returns a UACP payload."""
        import json
        start_time = time.time()
        result_text = agent_output.get("output", "")
        task_id = agent_output.get("task_id", "")
        
        prompt = f"""You are the System Critic.
Analyze the following agent output for hallucinations or logic errors.
CRITICAL INSTRUCTION: If the agent claims to have searched the web or scraped data, verify that the output contains actual concrete data/facts and not placeholders or hallucinations.

Agent Output:
{result_text[:2000]}

Rate the quality of this output from 0.0 (total failure/hallucination) to 1.0 (perfect).
Respond ONLY in valid JSON format:
{{
    "score": 0.8,
    "analysis": "Explanation of your rating."
}}"""

        try:
            if hasattr(self.model, "create_chat_completion"):
                response = self.model.create_chat_completion(
                    messages=[{"role": "user", "content": prompt}]
                )
                raw_json = response["choices"][0]["message"]["content"]
                # Clean markdown blocks if present
                clean_json = raw_json.replace("```json", "").replace("```", "").strip()
                result = json.loads(clean_json)
                score = float(result.get("score", 0.5))
                analysis = result.get("analysis", "No analysis provided.")
            else:
                score, analysis = self._heuristic_evaluate(result_text)
        except Exception as e:
            print(f"--- CriticAgent: LLM evaluation failed ({e}), falling back to heuristic ---")
            score, analysis = self._heuristic_evaluate(result_text)
        
        return UACPPayload(
            agent="critic",
            task_id=task_id,
            analysis=analysis,
            output=None,
            confidence=score,
            requires_revision=score < 0.7,
            notes_for_memory=f"Critique score: {score}",
            execution_time_ms=int((time.time() - start_time) * 1000)
        )

    def _heuristic_evaluate(self, result_text: str):
        score = 0.8
        analysis = "Output looks solid."
        
        if len(result_text) < 50:
            score = 0.5
            analysis = "Output is too brief. Logic gap detected."
            
        if "search_tool" in result_text and "No results" in result_text:
            score = 0.6
            analysis = "Search yielded no results, may need to revise query."
            
        return score, analysis
