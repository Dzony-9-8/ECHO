import sys
import asyncio
from llama_cpp import Llama

from core.planner import Planner
from core.router import TaskRouter
from core.synthesis import OutputSynthesizer
from core.persona import Persona
from memory.short_term import ShortTermMemory
from memory.long_term import LongTermMemory
from memory.importance import ImportanceScorer
from memory.summarizer import ConversationSummarizer
from memory.decay import MemoryDecay
from models.deepseek_r1 import DeepSeekR1
from models.deepseek_coder import DeepSeekCoder
from tools.registry import ToolRegistry
from tools.file_tools import read_file, write_file
from tools.shell_tools import run_shell
from tools.python_tools import run_python
from agents.executor import ExecutionAgent
from agents.verifier import VerificationAgent
from agents.loop import AgentLoop
from core.voice_stt import VoiceSTT
from core.voice_tts import VoiceTTS
from core.scheduler import BackgroundScheduler
from agents.background import BackgroundAgent
from core.mode_classifier import ModeClassifier
from runtime.profile_manager import ProfileManager
from runtime.profiles import AssistantProfile, DeveloperProfile, ResearchProfile, OSProfile, DevLeadProfile, QASpecialistProfile, SecurityAuditorProfile
from core.model_router import ModelRouter
from core.system_telemetry import SystemTelemetry
from core.swarm import SwarmController
from core.analyzer import TaskAnalyzer
from core.smart_router import SmartRouter
import time
import os

class Orchestrator:
    def __init__(self, profile_name="assistant"):
        # Profile-Based Runtime System
        self.profile_mgr = ProfileManager()
        self.profile_mgr.register("assistant", AssistantProfile())
        self.profile_mgr.register("developer", DeveloperProfile())
        self.profile_mgr.register("research", ResearchProfile())
        self.profile_mgr.register("os_runtime", OSProfile())
        self.profile_mgr.register("dev_lead", DevLeadProfile())
        self.profile_mgr.register("qa_specialist", QASpecialistProfile())
        self.profile_mgr.register("security_auditor", SecurityAuditorProfile())
        
        self.classifier = None # Lazy loaded
        self.requires_confirmation = False
        self.is_conversational = True
        self.mode_name = profile_name
        self.root_dir = os.getcwd()
        self.model_router = ModelRouter()
        self.telemetry = SystemTelemetry()
        self.swarm = SwarmController(self)

        # State for models
        self.model_instances = {} # name -> Llama instance
        self.model_leases = {} # name -> last_used_timestamp
        
        # Build absolute path to the models directory reliably
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        planner_path = os.path.join(base_dir, "models", "llama-3.1-8b.gguf")
        
        self.planner_llm = self._get_model_instance("planner", planner_path)
        self.reasoning_llm = None
        self.coder_llm = None
        self.embed_model = None
        
        # Components
        self.persona = Persona()
        self.planner = Planner(self.planner_llm, self.persona)
        self.synthesizer = OutputSynthesizer(self.planner_llm, self.persona)
        self.analyzer = TaskAnalyzer() # Will link dependency graph when available
        self.smart_router = SmartRouter()
        
        # Memory
        self.short_mem = ShortTermMemory()
        self.importance_scorer = ImportanceScorer()
        self.summarizer = ConversationSummarizer(self.planner_llm)
        self.decay_ctrl = MemoryDecay(half_life_days=30)
        self.long_mem = None

        # Voice
        self.stt = None
        self.tts = VoiceTTS()

        # Tools & Agents
        self.tools = ToolRegistry()
        self.tool_registry = self.tools
        self._register_tools()
        
        executor = ExecutionAgent(self.tools)
        verifier = VerificationAgent()
        self.agent_loop = AgentLoop(executor, verifier)
        self.router = TaskRouter(self.get_reasoning, self.get_coder, self.agent_loop)

        # Initial Profile Activation
        self.profile_mgr.activate(self.mode_name, self)

        # Background System
        self.bg_agent = BackgroundAgent(self)
        self.scheduler = BackgroundScheduler(self)
        self._setup_background_tasks()

    async def start_background_services(self):
        """Starts background tasks once the event loop is running."""
        print("--- Orchestrator: Starting background services ---")
        asyncio.create_task(self.scheduler.start())

    def _setup_background_tasks(self):
        """Register proactive tasks."""
        self.scheduler.add_task("Memory Consolidation", 300, self.bg_agent.consolidate_memory)
        self.scheduler.add_task("System Health", 600, self.bg_agent.check_system_health)

    def _load_model(self, path: str, n_gpu_layers: int = 0) -> Llama:
        print(f"--- Loading model: {path} (GPU Layers: {n_gpu_layers}) ---")
        try:
            return Llama(model_path=path, n_ctx=4096, n_gpu_layers=n_gpu_layers, temperature=0.2)
        except Exception as e:
            print(f"FATAL: Failed to load model {path}. {e}")
            sys.exit(1)

    def _get_model_instance(self, name, path, gpu_layers=30):
        """Loads or returns a model instance, updating its lease."""
        if name not in self.model_instances or self.model_instances[name] is None:
            # check vram before loading
            if self.telemetry.nvidia_available and not self.telemetry.check_vram_threshold(5.0):
                print(f"--- High VRAM Pressure: Offloading older models to load {name} ---")
                self.unload_idle_models(force=True)

            self.model_instances[name] = self._load_model(path, n_gpu_layers=gpu_layers)
        
        self.model_leases[name] = time.time()
        return self.model_instances[name]

    def unload_idle_models(self, idle_seconds=300, force=False):
        """Unloads models that haven't been used recently."""
        now = time.time()
        for name, last_used in list(self.model_leases.items()):
            if name == "planner": continue # Keep planner always for core orchestration
            
            if (force or (now - last_used > idle_seconds)) and self.model_instances.get(name):
                print(f"--- Resource Manager: Unloading {name} (Idle for {round(now-last_used)}s) ---")
                # Llama-cpp-python cleanup
                del self.model_instances[name]
                self.model_instances[name] = None
                if name in {"reasoning", "coder"}:
                    setattr(self, f"{name}_llm", None)
                # Python GC might take a moment, but this signals intent

    def _register_tools(self):
        self.tools.register("read_file", read_file, "Read file")
        self.tools.register("write_file", write_file, "Write file")
        self.tools.register("run_shell", run_shell, "Run safe shell")
        self.tools.register("run_python", run_python, "Execute python")

    def get_embedder(self):
        if self.embed_model is None:
            print("--- Loading Embedding Model ---")
            from memory.embeddings import EmbeddingModel
            self.embed_model = EmbeddingModel()
        return self.embed_model

    def get_long_term_mem(self):
        if self.long_mem is None:
            e = self.get_embedder()
            self.long_mem = LongTermMemory(dim=e.dim)
        return self.long_mem

    def get_reasoning(self):
        route = self.model_router.route("", profile=self.mode_name, is_planning=True)
        if route["engine"] == "cloud":
            return DeepSeekR1(api_key=route["api_key"], is_cloud=True)
            
        self.reasoning_llm = self._get_model_instance("reasoning", "ai-orchestrator/models/deepseek-r1.gguf")
        return DeepSeekR1(self.reasoning_llm)

    def get_coder(self):
        route = self.model_router.route("", profile=self.mode_name)
        model_name = "coder"
        model_path = "ai-orchestrator/models/deepseek-coder.gguf" if route["model"] == "deepseek-coder-v2" else "ai-orchestrator/models/llama-3.1-8b.gguf"
        self.coder_llm = self._get_model_instance(model_name, model_path)
        return DeepSeekCoder(self.coder_llm)

    def get_classifier(self):
        if self.classifier is None:
            self.classifier = ModeClassifier(self.planner_llm)
        return self.classifier

    async def process(self, user_input: str, use_voice: bool = False, skip_confirmation: bool = False):
        if not user_input.strip():
            return None

        # 1. Resolve Profile via Intent Detection
        classifier = self.get_classifier()
        auto_profile = classifier.classify(user_input)
        
        # Check for manual overrides or active profile persistence
        # For simplicity, we activate the auto-detected profile or keep the current if manual
        if not hasattr(self, 'manual_profile') or not self.manual_profile:
            self.profile_mgr.activate(auto_profile, self)
        
        # 2. Safety Check (Research/Autonomous)
        if self.requires_confirmation and not skip_confirmation:
            print("--- Warning: Research Runtime activation requested ---")
            confirm = input("Allow autonomous execution? (y/n): ")
            if confirm.lower() != 'y':
                print("--- Profile Manager: Reverting to Assistant ---")
                self.profile_mgr.activate("assistant", self)

        self.short_mem.add("user", user_input)
        
        memories = []
        try:
            e = self.get_embedder()
            ltm = self.get_long_term_mem()
            query_emb = e.embed(user_input)
            memories = ltm.query(query_emb, k=3, decay_obj=self.decay_ctrl)
        except Exception as e_mem:
            print(f"--- WARNING: Context retrieval failed: {e_mem} ---")

        plan = self.planner.plan(user_input, self.short_mem.context(), memories)
        
        # 3. Smart Routing & Escalation
        # We need a list of files. For now, we can extract from intent or plan.
        files_involved = [t["args"].get("path") for t in plan.tool_calls if "path" in t["args"]]
        analysis = self.analyzer.analyze(user_input, files_involved)
        
        route_target = self.smart_router.route(analysis, plan.confidence)
        
        if route_target == "deepseek_r1_api":
            print(f"--- Escalating to CLOUD (DeepSeek-R1) due to complexity ({analysis['complexity_score']}) or low confidence ({plan.confidence}) ---")
            # Force cloud reasoning for this plan
            plan.models = ["deepseek_r1"]
            plan.reasoning_required = True
        
        # Tool filtering is now handled by the registry itself (enabled/disabled)
        # We just need to ensure the router only executes enabled tools
        outputs = await self.agent_loop.run(plan, plan.tool_calls) if plan.tool_calls else {}
        
        # If reasoning was required, or we escalated, we might need a reasoning step
        if plan.reasoning_required:
            reasoner = self.get_reasoning()
            outputs["reasoning"] = reasoner.run(user_input)

        print("\nAI: ", end="", flush=True)
        final_answer = self.synthesizer.synthesize(plan, outputs)
        print("\n")

        if use_voice:
            self.tts.speak_async(final_answer)

        self.short_mem.add("ai", final_answer)

        # Persistence
        try:
            interact_text = f"User: {user_input}\nAI: {final_answer}"
            score = self.importance_scorer.score(interact_text)
            if score >= 0.4:
                e = self.get_embedder()
                ltm = self.get_long_term_mem()
                emb = e.embed(interact_text)
                ltm.add(emb, interact_text, score)
        except Exception as e_ltm:
            print(f"--- WARNING: Long-term storage failed: {e_ltm} ---")

        # Episodic (Summarization)
        if len(self.short_mem.buffer) >= 20: 
            try:
                dialogue = self.short_mem.context()
                summary = self.summarizer.summarize(dialogue)
                self.short_mem.buffer = self.short_mem.buffer[-2:] 
            except Exception as e_sum:
                print(f"--- WARNING: Summarization failed: {e_sum} ---")

        return final_answer

    def switch_mode(self, profile_name: str):
        """Manually switches the system profile."""
        print(f"--- Switching to profile: {profile_name} ---")
        if self.profile_mgr.activate(profile_name, self):
            self.manual_profile = profile_name
            return True
        return False
