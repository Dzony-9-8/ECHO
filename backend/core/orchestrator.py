from .memory_engine import memory_engine
from .router import router
from .rag_engine import rag_engine
from .web_engine import web_engine
from .weather_engine import weather_engine
from .intent_detector import intent_detector
from .research_engine import research_engine
from .image_engine import image_engine
from ..llm.registry import get_llm_adapter
import uuid
import json

class Orchestrator:
    def process_request(self, request_data: dict):
        mode_val = request_data.get("mode", "chat")
        messages = request_data.get("messages", [])
        if not messages:
            return self._format_error("No messages provided")
            
        user_msg = messages[-1].get("content", "")
        
        # WEATHER ENGINE INTEGRATION
        weather_context = ""
        weather_triggered = False
        tools = request_data.get("tools", [])
        
        # Check explicit tool call in `messages` (if passed as tool_calls)
        # OR Check implicit intent NLP
        explicit_weather_call = False
        for msg in messages:
            if "tool_calls" in msg:
                for t in msg["tool_calls"]:
                    if t.get("function", {}).get("name") == "get_weather":
                        explicit_weather_call = True
                        break

        if explicit_weather_call or tools:
            # Handle explicit tool parameters if needed, but for simplicity we rely on intent or hardcode
            pass # Expand if frontend starts sending explicit tool calls
            
        # Run NLP intent detector if no explicit tool is forcing it
        if request_data.get("weather_enabled", False):
            detected_location = intent_detector.detect_weather_intent(user_msg)
            if detected_location:
                weather_triggered = True
                weather_data = weather_engine.get_weather(detected_location)
                if "error" not in weather_data:
                    weather_context = f"Weather Data for {detected_location}:\n{json.dumps(weather_data, indent=2)}\nSummarize this weather beautifully to the user."
                    mode_val = "weather" # Force weather mode for factual delivery
        
        mode_config = router.get_route(mode_val)
        system_prompt = mode_config["system_prompt"]

        web_context = ""
        if request_data.get("web_enabled", False):
            if not getattr(web_engine, "enabled", False):
                web_context = "(Note: Web search was requested but is not enabled/installed locally.)"
            else:
                web_context = web_engine.get_context_string(user_msg)
            
        rag_context = ""
        if request_data.get("rag_enabled", False):
            if not getattr(rag_engine, "enabled", False):
                rag_context = "(Note: RAG memory was requested but vector database dependencies are not installed.)"
            else:
                retrieved = rag_engine.retrieve(user_msg)
                if retrieved:
                    rag_context = "Relevant Knowledge:\n" + "\n".join(retrieved)

        research_context = ""
        depth = request_data.get("research_depth", 0)
        if depth > 0:
            research_context = research_engine.execute_research(user_msg, depth)
            
        final_system = system_prompt
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
                model=request_data.get("model")
            )
            
            resp = {
                "id": f"chatcmpl-local-{uuid.uuid4()}",
                "object": "chat.completion",
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": response_text
                    },
                    "finish_reason": "stop"
                }]
            }
            if weather_triggered and "error" not in weather_data:
                resp["weather_data"] = weather_data
            return resp
        except Exception as e:
            return self._format_error(str(e))

    def _format_error(self, msg: str):
        return {
            "error": msg
        }

orchestrator = Orchestrator()
