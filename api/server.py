from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio
import sys
import os

# Ensure ai-orchestrator is in path for imports
base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
orchestrator_path = os.path.join(base_path, "ai-orchestrator")
if orchestrator_path not in sys.path:
    sys.path.append(orchestrator_path)

from core.orchestrator import Orchestrator

app = FastAPI(title="Project ECHO API")
orchestrator = Orchestrator()

@app.on_event("startup")
async def startup_event():
    await orchestrator.start_background_services()

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    voice: bool = False

@app.post("/chat")
async def chat(req: ChatRequest):
    response = await orchestrator.process(req.message, use_voice=req.voice)
    return {"response": response}

@app.get("/stream")
async def stream_chat(message: str, voice: bool = False, profile: str = "assistant"):
    # Switch profile if provided
    orchestrator.switch_mode(profile)
    
    async def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'status', 'content': f'Orchestrating with {profile} profile...'})}\n\n"
            
            response = await orchestrator.process(message, use_voice=voice, skip_confirmation=True)
            
            if response is None:
                response = "I processed your request but couldn't generate a response. Please try again."
            
            yield f"data: {json.dumps({'type': 'content', 'content': str(response)})}\n\n"
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            print(f"--- STREAM ERROR: {error_detail} ---")
            yield f"data: {json.dumps({'type': 'content', 'content': f'Error: {str(e)}'})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# --- NEW ECHO FRONTEND DECOUPLING: UACP AgentManager Pipeline ---

@app.post("/query")
async def query_endpoint(payload: dict):
    """
    Unified access point for the ECHO frontend.
    Routes structured payloads to the Supervisor/AgentManager pipeline.
    """
    user_input = payload.get("user_input")
    task_type = payload.get("task_type", "conversation")
    tags = payload.get("tags", [])

    if not user_input:
        return {"outputs": [{"agent": "system", "output": "Empty input provided.", "confidence": 0.0}]}

    try:
        # Load necessary tools via orchestrator's Intelligence Layer and AgentManager
        # Using orchestrator to access memory & bg agents
        from agents.agent_manager import AgentManager
        from agents.dev_agent import DevAgent
        from agents.research_agent import ResearchAgent
        from agents.critic_agent import CriticAgent
        
        # Initialize the UACP Tool wrappers
        from tools.echo_tools.memory_adapter import MemoryAdapter
        from tools.echo_tools.search_tool import SearchTool
        from tools.echo_tools.scrape_tool import ScrapeTool
        from tools.echo_tools.credibility_tool import CredibilityTool
        
        mem_adapter = MemoryAdapter(orchestrator.telemetry) # Intelligence layer interface proxy

        # Hardcode test registries for standalone API endpoint execution
        dev = DevAgent(orchestrator.planner_llm, orchestrator.tools, None)
        res = ResearchAgent(orchestrator.planner_llm, orchestrator.tools, None) 
        cri = CriticAgent(orchestrator.planner_llm)

        manager = AgentManager(dev, res, cri, mem_adapter)

        # Run multi-agent pipeline
        agent_response = manager.run(objective=user_input)
        
        # Format response into expected frontend outputs array
        response_payload = {
            "outputs": [agent_response]
        }

        # Handle specific ECHO tools if explicitly requested by frontend mode/task_type
        if task_type == "search":
            search_tool = SearchTool(mem_adapter)
            tool_output = search_tool.execute(user_input)
            response_payload["tool_output"] = tool_output
            
        elif task_type == "scrape":
            scrape_tool = ScrapeTool(mem_adapter)
            tool_output = scrape_tool.execute(user_input)
            response_payload["tool_output"] = tool_output
            
        return response_payload

    except Exception as e:
        import traceback
        print(f"--- /query ENDPOINT ERROR: {traceback.format_exc()} ---")
        return {"outputs": [{"agent": "system", "output": f"Backend Error: {str(e)}", "confidence": 0.0}]}

# -----------------------------------------------------------------

@app.post("/profile")
async def set_profile(profile: str):
    success = orchestrator.switch_mode(profile)
    return {"success": success, "current_profile": profile}

@app.post("/dev/plan")
async def dev_plan(objective: str):
    # Ensure developer profile is active
    if orchestrator.mode_name != "developer":
        orchestrator.switch_mode("developer")
        
    if hasattr(orchestrator, 'dev_core'):
        plan = orchestrator.dev_core.plan_change(objective)
        return {"plan": plan}
    return {"error": "Developer core not initialized"}

@app.get("/profile")
async def get_profile():
    return {"profile": orchestrator.mode_name}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
