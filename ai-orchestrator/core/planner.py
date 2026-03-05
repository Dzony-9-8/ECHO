"""Central planner — interprets intent, selects specialists and tools, outputs JSON only."""
import json
import re
from pydantic import BaseModel


class Plan(BaseModel):
    task: str
    reasoning_required: bool
    coding_required: bool
    models: list[str]
    tool_calls: list[dict] = []
    output_style: str = "normal"
    confidence: float = 1.0


PLANNER_SYSTEM_TEMPLATE = """
SYSTEM: You are the Project ECHO Planner.
Analyze the USER REQUEST and decompose it into a JSON plan.

Available Tools: read_file(path), write_file(path, content), run_shell(cmd), run_python(code).
Available Models: deepseek_r1 (deep analysis), deepseek_coder (code generation).

RULES:
1. Fill 'task' with a concise summary (max 10 words) of WHAT THE USER WANTS. Do not use placeholders.
2. For greetings or casual chat: reasoning_required=false, tool_calls=[].
3. For analysis/research: reasoning_required=true, models=["deepseek_r1"].
4. For coding: coding_required=true, models=["deepseek_coder"].

Output ONLY valid JSON:
{{
  "task": "summary of actual user request",
  "reasoning_required": false,
  "coding_required": false,
  "models": [],
  "tool_calls": [],
  "output_style": "normal"
}}

USER REQUEST: {user_input}
CONTEXT: {short_memory}
MEMORY: {long_memory}

JSON:
"""


class Planner:
    def __init__(self, model, persona):
        self.model = model
        self.persona = persona

    def plan(
        self,
        user_input: str,
        short_memory: str,
        long_memory_hits: str | list,
    ) -> Plan:
        if isinstance(long_memory_hits, list):
            long_memory_str = "\n".join(long_memory_hits) if long_memory_hits else "(none)"
        else:
            long_memory_str = long_memory_hits or "(none)"

        prompt = PLANNER_SYSTEM_TEMPLATE.format(
            short_memory=short_memory or "(none)",
            long_memory=long_memory_str,
            user_input=user_input,
        )
        raw = self.model(prompt, max_tokens=512)
        text = raw["choices"][0]["text"]
        print(f"--- DEBUG: Planner Response: {text.strip()} ---")

        # 1. Parse JSON
        if json_match := re.search(r"(\{[\s\S]*\})", text):
            text = json_match.group(1)
        
        # Cleanup
        text = re.sub(r'(\]|\})\s+"\b', r'\1, "', text)
        text = re.sub(r'(\d|true|false|null)\s+"\b', r'\1, "', text)

        try:
            data = json.loads(text)
            plan = Plan(**data)
        except Exception as e:
            print(f"--- DEBUG: JSON Parse Error: {e} ---")
            tools = []
            tool_matches = re.findall(r'\{\s*"tool":\s*"([^"]+)",\s*"args":\s*(\{[\s\S]*?\})\s*\}', text)
            for t_name, t_args_str in tool_matches:
                try:
                    tools.append({"tool": t_name, "args": json.loads(t_args_str)})
                except: continue
            
            plan = Plan(
                task=user_input, 
                reasoning_required="deepseek_r1" in text,
                coding_required="deepseek_coder" in text,
                models=["deepseek_r1"] if "deepseek_r1" in text else [],
                tool_calls=tools
            )

        # 2. Confidence Self-Rating
        plan.confidence = self.estimate_confidence(user_input, plan)
        return plan

    def estimate_confidence(self, user_input: str, plan: Plan) -> float:
        """Asks the model to rate its confidence in the generated plan."""
        prompt = f"""
        RATE YOUR CONFIDENCE:
        Goal: {user_input}
        Proposed Plan: {plan.json()}

        How confident are you that this plan solves the user's request accurately and safely?
        Think about tool selection and execution steps.
        Rate from 0.0 to 1.0.
        Output ONLY the number.
        """
        try:
            raw = self.model(prompt, max_tokens=10)
            text = raw["choices"][0]["text"].strip()
            return float(score_match.group(1)) if (score_match := re.search(r"(\d?\.\d+)", text)) else 0.7
        except:
            return 0.5
