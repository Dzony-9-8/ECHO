"""
ECHO V3 — Orchestrator
Central routing layer. Uses tools/ registry for all feature invocations.
Resource profile is wired through from system_monitor for future adaptive behaviour.
"""

from .router import router
from .intent_detector import intent_detector
from .image_engine import image_engine
from .system_monitor import system_monitor
from ..llm.registry import get_llm_adapter
from ..tools import WeatherTool, WebTool, RAGTool, ResearchTool
import uuid
import json

class Orchestrator:
    def __init__(self):
        # V3: Registered tool instances — swap or extend here
        self.tools = {
            "get_weather":  WeatherTool(),
            "web_search":   WebTool(),
            "rag_retrieve": RAGTool(),
            "deep_research": ResearchTool(),
        }

    def process_request(self, request_data: dict):
        # V3: Resource profile — wired through for future adaptive limits
        resource_profile = system_monitor.get_profile()

        mode_val = request_data.get("mode", "chat")
        messages  = request_data.get("messages", [])
        if not messages:
            return self._format_error("No messages provided")

        user_msg = messages[-1].get("content", "")

        # ── WEATHER ──────────────────────────────────────────────────────────
        weather_context  = ""
        weather_data     = {}
        weather_triggered = False

        if request_data.get("weather_enabled", False):
            detected_location = intent_detector.detect_weather_intent(user_msg)
            if detected_location:
                result = self.tools["get_weather"].execute({"location": detected_location})
                if not result["error"] and result["result"]:
                    weather_data     = result["result"]
                    weather_triggered = True
                    weather_context  = (
                        f"Weather Data for {detected_location}:\n"
                        f"{json.dumps(weather_data, indent=2)}\n"
                        f"Summarize this weather beautifully to the user."
                    )
                    mode_val = "weather"

        # ── WEB SEARCH ───────────────────────────────────────────────────────
        web_context = ""
        if request_data.get("web_enabled", False):
            result = self.tools["web_search"].execute({"query": user_msg})
            web_context = result.get("result", "")

        # ── RAG ──────────────────────────────────────────────────────────────
        rag_context = ""
        if request_data.get("rag_enabled", False):
            result = self.tools["rag_retrieve"].execute({"query": user_msg})
            if not result["error"] and result["result"]:
                rag_context = "Relevant Knowledge:\n" + "\n".join(result["result"])
            elif result["error"]:
                rag_context = f"({result['error']})"

        # ── DEEP RESEARCH ────────────────────────────────────────────────────
        research_context = ""
        depth = request_data.get("research_depth", 0)
        if depth > 0:
            result = self.tools["deep_research"].execute({"query": user_msg, "depth": depth})
            research_context = result.get("result", "")

        # ── ASSEMBLE SYSTEM PROMPT ───────────────────────────────────────────
        mode_config  = router.get_route(mode_val)
        final_system = mode_config["system_prompt"]
        if mode_config.get("formatting"):
            final_system += f"\nFormat requirements: {mode_config['formatting']}"
        if rag_context:
            final_system += f"\n\n{rag_context}"
        if web_context:
            final_system += f"\n\n{web_context}"
        if research_context:
            final_system += f"\n\n{research_context}"
        if weather_context:
            final_system += f"\n\n{weather_context}"

        llm_messages = [{"role": "system", "content": final_system}]
        llm_messages.extend(messages)

        images = image_engine.process_images(request_data.get("images", []))

        try:
            adapter = get_llm_adapter()
            response_text = adapter.generate(
                messages=llm_messages,
                temperature=mode_config["temperature"],
                images=images,
                model=request_data.get("model"),
                resource_profile=resource_profile   # V3: passed for future use
            )

            resp = {
                "id": f"chatcmpl-local-{uuid.uuid4()}",
                "object": "chat.completion",
                "choices": [{
                    "index": 0,
                    "message": {"role": "assistant", "content": response_text},
                    "finish_reason": "stop"
                }]
            }
            if weather_triggered:
                resp["weather_data"] = weather_data
            return resp

        except Exception as e:
            return self._format_error(str(e))

    def _format_error(self, msg: str):
        return {"error": msg}

orchestrator = Orchestrator()
