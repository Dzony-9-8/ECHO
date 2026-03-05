import asyncio
import json

class BackgroundAgent:
    def __init__(self, orchestrator):
        self.orchestrator = orchestrator

    async def consolidate_memory(self):
        """A background task that reviews short-term memory and saves key insights."""
        context = self.orchestrator.short_mem.context()
        if not context or len(context) < 300: # Wait for enough content
            return

        print("--- Background Agent: Consolidating memory... ---")
        
        prompt = f"""
        Analyze the following conversation history. Extract any important facts, user preferences, or project details that should be remembered permanently.
        Format your response as a simple list of facts. If nothing is worth remembering, return 'NONE'.

        History:
        {context}

        Facts to remember:
        """
        
        try:
            # Use the planner LLM (Llama 3.1 8B) for this task as it's fast and reliable for extraction
            response = self.orchestrator.planner_llm(
                prompt,
                max_tokens=256,
                stop=["User:", "AI:"],
                echo=False
            )
            
            fact_text = response['choices'][0]['text'].strip()
            
            if fact_text and "NONE" not in fact_text.upper():
                print(f"--- Background Agent: Insight found: {fact_text[:50]}... ---")
                
                # Get embeddings and store
                e = self.orchestrator.get_embedder()
                ltm = self.orchestrator.get_long_term_mem()
                emb = e.embed(fact_text)
                
                # We use a high base importance for consolidated insights
                ltm.add(emb, f"[CONSOLIDATED]: {fact_text}", 0.8)
                
        except Exception as e:
            print(f"--- ERROR in memory consolidation: {e} ---")

    async def check_system_health(self):
        """Proactively checks model status, disk space, and resource pressure."""
        print("--- Background Agent: Checking system health... ---")
        
        # 1. Resource Monitoring
        stats = self.orchestrator.telemetry.get_stats()
        print(f"--- System Telemetry: CPU: {stats['cpu_percent']}% | RAM: {stats['ram']['used_percent']}% ---")
        
        if stats['gpu']:
            for g in stats['gpu']:
                print(f"--- GPU {g['id']} ({g['name']}): VRAM: {g['vram_percent']}% ---")

        # 2. Predictive Offloading
        # If VRAM is tight (>85%) or RAM is tight (>90%), unload idle models immediately
        vram_pressure = any(g['vram_percent'] > 85 for g in stats['gpu']) if stats['gpu'] else False
        ram_pressure = stats['ram']['used_percent'] > 90
        
        if vram_pressure or ram_pressure:
            print("--- Resource Warning: High pressure detected. Cleaning up... ---")
            self.orchestrator.unload_idle_models(idle_seconds=60) # Aggressive cleanup
        else:
            self.orchestrator.unload_idle_models(idle_seconds=600) # Standard cleanup

        # 3. FAISS Check
        try:
            ltm = self.orchestrator.get_long_term_mem()
            if ltm.index.ntotal >= 0:
                print(f"--- Background Agent: FAISS Index Healthy ({ltm.index.ntotal} records) ---")
        except Exception as e:
            print(f"--- WARNING: Background health check failed: {e} ---")
        
        await asyncio.sleep(0.1)
