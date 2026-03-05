"""Output synthesizer — single voice: merges reasoning, code, tools; applies persona and reflection."""
from .planner import Plan


class OutputSynthesizer:
    def __init__(self, model, persona):
        self.model = model
        self.persona = persona

    def synthesize(self, plan: Plan, outputs: dict) -> str:
        reasoning = outputs.get("reasoning", "")
        code = outputs.get("code", "")
        tools_out = outputs.get("tools", [])

        if isinstance(tools_out, list):
            tools_str = "\n".join(str(x) for x in tools_out)
        else:
            tools_str = str(tools_out)

        # Build context section only if there's actual data
        context_parts = []
        if reasoning and reasoning != "Reasoning engine not available.":
            context_parts.append(f"Analysis: {reasoning}")
        if code:
            context_parts.append(f"Code: {code}")
        if tools_str:
            context_parts.append(f"Tool Results: {tools_str}")
        
        context = "\n".join(context_parts) if context_parts else ""

        prompt = f"""You are Project ECHO, a highly capable and intelligent AI assistant. 
Respond naturally and directly to the USER'S REQUEST. 

USER'S REQUEST: {plan.task}
{f"RESEARCH CONTEXT: {context}" if context else ""}

INSTRUCTIONS:
1. Provide a direct, helpful, and concise response.
2. If research data is present, use it to provide a detailed answer.
3. Stay conversational and professional.
4. Respond ONLY with the final answer.

RESPONSE:"""

        res = self.model(prompt, max_tokens=512, stream=True)
        final = ""
        for chunk in res:
            token = chunk["choices"][0]["text"]
            print(token, end="", flush=True)
            final += token
        
        return (
            (final := final.strip())
            or "I'm here and ready to help. What would you like to know?"
        )
