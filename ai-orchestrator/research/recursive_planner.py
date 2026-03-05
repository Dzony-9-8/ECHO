from intelligence.interface import IntelligenceLayer

class RecursivePlanner:
    def __init__(self, llm, embedder=None):
        self.llm = llm
        self.intelligence = IntelligenceLayer(embedder)

    def decompose(self, complex_task: str):
        """Decomposes a complex task into a sequence of sub-tasks."""
        print(f"--- Research Profile: Decomposing task: '{complex_task}' ---")
        prompt = f"""
        Decompose the following complex task into a set of independent sub-tasks:
        "{complex_task}"
        
        Respond with a bulleted list of sub-tasks.
        """
        # In a real implementation, would parse the LLM response into a list
        sub_tasks = ["Analyze requirements", "Investigate bottlenecks", "Propose solution"]
        
        # Store in semantic memory
        self.intelligence.store_research_conclusion(
            text=f"Task: {complex_task}\nDecomposition: {', '.join(sub_tasks)}",
            meta={"task": complex_task, "type": "decomposition"}
        )
        
        return sub_tasks
