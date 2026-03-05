from typing import Dict, Any, List
from agents.agent_manager import AgentManager
from agents.dev_agent import DevAgent
from agents.research_agent import ResearchAgent
from agents.critic_agent import CriticAgent
from developer.core import DeveloperCore
from research.recursive_planner import RecursivePlanner
from research.task_spawner import TaskSpawner
from intelligence.interface import IntelligenceLayer
from os_runtime.system_monitor import SystemMonitor
from os_runtime.event_listener import EventListener
from agents.specialists import DevLeadPersona, QASpecialistPersona, SecurityAuditorPersona

class AssistantProfile:
    def configure(self, core):
        core.agent_loop.max_iters = 2
        core.tool_registry.filter(["read_file", "write_file"])
        core.mode_name = "assistant"
        print("--- Assistant Runtime configured ---")

class DeveloperProfile:
    def configure(self, core):
        core.agent_loop.max_iters = 7
        core.mode_name = "developer"
        core.autonomy = "semi"
        
        # Central Developer Core (use root_dir, not repo_path which doesn't exist)
        root = core.root_dir if hasattr(core, 'root_dir') else "."
        core.dev_core = DeveloperCore(root)
        core.dev_core.set_embedder(core.get_embedder())
        core.dev_core.initialize()
        
        # Intelligence Layer
        core.intel = IntelligenceLayer()
        
        # Refined Agent Coordination
        dev_agent = DevAgent(core.dev_core)
        research_agent = ResearchAgent(RecursivePlanner(core.get_reasoning(), core.get_embedder()))
        critic_agent = CriticAgent(core.get_reasoning())
        core.agents = AgentManager(dev_agent, research_agent, critic_agent, core.intel)
        
        # Smart Routing Integration: Link dependency graph for depth analysis
        if hasattr(core, 'analyzer'):
            core.analyzer.dependency_graph = core.dev_core.dependency_graph

        # Register tools (proxied to dev_core)
        core.tools.register("repo_index", core.dev_core.indexer.index, "Deep structural repo indexing")
        core.tools.register("run_tests", core.dev_core.run_tests, "Run all project tests") # Changed description
        core.tools.register("generate_patch", core.dev_core.patch_gen.generate_patch, "Generate unified diff patch")
        
        def code_search(query: str, top_k: int = 5):
            return core.dev_core.embedding_index.search(query, top_k)
            
        core.tools.register("code_search", code_search, "Search codebase semantically")
        core.tools.register("create_plan", core.dev_core.plan_change, "Create a structured dev plan")
        core.tools.register("rename_symbol", core.dev_core.refactor.rename_function, "Global symbol rename")
        core.tools.register("git_branch", core.dev_core.git.create_branch, "Create new git branch")
        core.tools.register("git_commit", core.dev_core.git.commit, "Commit changes to git")
        core.tools.register("predict_impact", core.dev_core.predict_impact, "Predict blast radius of a file change")
        
        def search_memory(query: str, top_k: int = 5):
            return core.dev_core.intelligence.search_past_insight(query, top_k)
            
        async def swarm(objective: str):
            return await core.agents.run(objective)
            
        from tools.echo_tools import MemoryAdapter, SearchTool, ScrapeTool

        memory_adapter = MemoryAdapter(core.intel)
        search = SearchTool(memory_adapter)
        scrape = ScrapeTool(memory_adapter)

        core.tools.register("search_memory", search_memory, "Search past reasoning traces and experiences")
        core.tools.register("swarm", swarm, "Coordinate a multi-agent swarm for complex objectives")
        core.tools.register("search_tool", search.execute, "Search the public web for real-time information")
        core.tools.register("scrape_tool", scrape.execute, "Extract clean text content from a URL")

        # Allow all dev tools
        core.tools.filter([
            "read_file", "write_file", "run_shell", "run_python",
            "repo_index", "run_tests", "generate_patch", "code_search",
            "create_plan", "rename_symbol", "git_branch", "git_commit",
            "predict_impact", "search_memory", "swarm", "search_tool", "scrape_tool"
        ])
        
        print("--- Developer Runtime: CORE-DRIVEN ARCHITECTURE ACTIVE ---")

class ResearchProfile:
    def configure(self, core):
        core.agent_loop.max_iters = 15
        core.tool_registry.filter(["read_file", "write_file", "run_shell", "run_python"])
        core.mode_name = "research"
        core.requires_confirmation = True
        
        # Capability Layer
        core.spawner = TaskSpawner(core)
        core.recursive_planner = RecursivePlanner(core.get_reasoning(), core.get_embedder())
        
        # Intelligence Abstraction
        core.intel = IntelligenceLayer(core.get_embedder())
        
        # Refined Agent Coordination
        root = core.root_dir if hasattr(core, 'root_dir') else "."
        dev_agent = DevAgent(DeveloperCore(root))
        research_agent = ResearchAgent(core.recursive_planner)
        critic_agent = CriticAgent(core.get_reasoning())
        core.agents = AgentManager(dev_agent, research_agent, critic_agent, core.intel)
        
        def analyze_system():
            return core.intel.analyze_performance()
            
        def search_past_insight(query: str, top_k: int = 5):
            return core.intel.search_past_insight(query, top_k)
            
        def optimize_system():
            return core.intel.optimize_system()
            
        def check_health():
            return core.intel.check_health()
            
        from tools.echo_tools import MemoryAdapter, SearchTool, ScrapeTool

        memory_adapter = MemoryAdapter(core.intel)
        search = SearchTool(memory_adapter)
        scrape = ScrapeTool(memory_adapter)

        core.tools.register("analyze_system", analyze_system, "Deep analysis of system routing failures")
        core.tools.register("search_past_insight", search_past_insight, "Search semantically through all past project research and conclusions")
        core.tools.register("optimize_system", optimize_system, "Trigger nightly sentinel optimization scan")
        core.tools.register("check_health", check_health, "Get high-level system health metrics")
        core.tools.register("search_tool", search.execute, "Search the public web for real-time information")
        core.tools.register("scrape_tool", scrape.execute, "Extract clean text content from a URL")

        # Allow all research tools
        core.tools.filter([
            "read_file", "write_file", "run_shell", "run_python",
            "analyze_system", "search_past_insight", "optimize_system", "check_health",
            "search_tool", "scrape_tool"
        ])
        
        print("--- Research Runtime configured (Autonomous) with Subtask Spawning ---")

class OSProfile:
    def configure(self, core):
        core.agent_loop.max_iters = 1
        core.tool_registry.filter(["run_shell", "run_python"])
        core.mode_name = "os_runtime"
        core.is_conversational = False
        
        # Capability Layer
        core.monitor = SystemMonitor()
        core.listener = EventListener(".")
        
        print("--- Local AI OS Runtime configured (Event-Driven) with System Watcher ---")

class DevLeadProfile:
    def configure(self, core):
        core.agent_loop.max_iters = 5
        core.mode_name = "dev_lead"
        core.persona = DevLeadPersona()
        core.tools.filter(["code_search", "predict_impact", "create_plan", "read_file"])
        print("--- Swarm Specialist: DevLead Active ---")

class QASpecialistProfile:
    def configure(self, core):
        core.agent_loop.max_iters = 5
        core.mode_name = "qa_specialist"
        core.persona = QASpecialistPersona()
        core.tools.filter(["run_tests", "read_file", "write_file"])
        print("--- Swarm Specialist: QASpecialist Active ---")

class SecurityAuditorProfile:
    def configure(self, core):
        core.agent_loop.max_iters = 3
        core.mode_name = "security_auditor"
        core.persona = SecurityAuditorPersona()
        core.tools.filter(["code_search", "read_file"])
        print("--- Swarm Specialist: SecurityAuditor Active ---")
