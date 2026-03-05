import sys
import asyncio
from pathlib import Path
from unittest.mock import MagicMock

# Add project root to sys.path
project_root = Path(__file__).resolve().parent
sys.path.append(str(project_root))

from agents.agent_manager import AgentManager
from agents.dev_agent import DevAgent
from agents.research_agent import ResearchAgent
from agents.critic_agent import CriticAgent
from intelligence.interface import IntelligenceLayer
from memory.embeddings import EmbeddingModel
from developer.core import DeveloperCore
from research.recursive_planner import RecursivePlanner

def run_simulation():
    print("=== Starting ECHO Swarm Simulation ===")
    
    # 1. Setup Mock Models
    class MockLLM:
        def create_chat_completion(self, messages, **kwargs):
            last_msg = messages[-1]["content"] if messages else ""
            if "System Critic" in last_msg:
                # Critic evaluation
                return {
                    "choices": [{
                        "message": {
                            "content": '{"score": 0.9, "analysis": "Excellent search results, verified fact."}'
                        }
                    }]
                }
            elif "Research Plan" in last_msg or "Task" in last_msg:
                # Research Agent output
                return {
                    "choices": [{
                        "message": {
                            "content": "I have researched the topic. Here are the findings:\nQuantum breakthroughs exist."
                        }
                    }]
                }
            return {"choices": [{"message": {"content": "Mock Response"}}]}

    mock_model = MockLLM()
    embedder = EmbeddingModel()
    intel = IntelligenceLayer(embedder)

    # 2. Setup Core Components
    dev_core = DeveloperCore(".")
    dev_core.set_embedder(embedder)
    dev_core.initialize()
    dev_core.intel = intel
    
    planner = RecursivePlanner(mock_model, embedder)
    
    # Register ECHO Tools to Research Profile (simulating profiles.py)
    from tools.echo_tools import MemoryAdapter, SearchTool
    memory_adapter = MemoryAdapter(intel)
    search = SearchTool(memory_adapter)
    
    test_tools = {}
    test_tools["search_tool"] = search.execute

    # 3. Setup Swarm
    dev_agent = DevAgent(dev_core)
    research_agent = ResearchAgent(planner)
    
    # Override Research Agent's execute for simulation purposes to avoid full LLM loops
    def mock_research_execute(objective):
        from agents.protocol import UACPPayload
        print(f"--- ResearchAgent: Executing objective: {objective} ---")
        # Trigger the tool to test memory logging
        res = test_tools["search_tool"]("Latest quantum computing news 2024", 2)
        
        return UACPPayload(
            agent="research_agent",
            task_id="test_task_001",
            analysis="Initial findings completed.",
            output=f"I found the following data:\n{res.get('output')}",
            confidence=0.9,
            notes_for_memory="Research step 1 complete",
            execution_time_ms=1500
        )
    
    research_agent.execute = mock_research_execute
    
    critic_agent = CriticAgent(mock_model)
    manager = AgentManager(dev_agent, research_agent, critic_agent, intel)

    # 4. Inject some memory to test Supervisor routing
    intel.store_research_conclusion(
        "Past task: Analyze new tech trends", 
        {"tags": ["research", "search"]}
    )

    # 5. Run Objective
    objective = "Find out the latest news about Quantum Computing in 2024."
    print("\n[Step 1] Supervisor routing decision...")
    role = manager.supervisor.decide(objective)
    print(f"-> Supervisor routed task to: {role}")
    assert role == "research", "Supervisor failed to route to research based on memory!"

    print("\n[Step 2] Executing Swarm Path...")
    final_payload = manager.run(objective)
    
    print("\n[Step 3] Validating Loop & Final Payload...")
    print(f"Final Outcome payload keys: {final_payload.keys()}")
    print(f"Critic Confidence: {final_payload.get('confidence')}")
    
    print("\n[Step 4] Validating IntelligenceLayer Memory Writes...")
    # Search for the query to see if it was logged
    history = intel.search_past_insight("Quantum Computing", top_k=5)
    
    legacy_logged = False
    for score, meta in history:
        if meta.get("source") == "echo_tool":
            legacy_logged = True
            print(f"-> Verified: Search tool usage successfully caught in vector memory! (Score: {score:.2f})")
            break
            
    assert legacy_logged, "ECHO Tools memory hooking failed!"
    print("\n=== All Tests Passed! SWARM INTEGRATION SUCCESSFUL ===")

if __name__ == "__main__":
    run_simulation()
