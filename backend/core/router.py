MODES = {
    "chat": {
        "system_prompt": "You are ECHO, a helpful and emotional hybrid AI assistant.",
        "temperature": 0.7,
        "formatting": "Standard conversational format."
    },
    "analysis": {
        "system_prompt": "You are ECHO, an analytical AI focused on breaking down complex problems logically.",
        "temperature": 0.2,
        "formatting": "Structured breakdown with headers and bullet points."
    },
    "research": {
        "system_prompt": "You are ECHO, a deeply inquisitive research assistant.",
        "temperature": 0.4,
        "formatting": "Comprehensive summary with citations and evidence."
    },
    "code": {
        "system_prompt": "You are ECHO, an expert software engineer and code interpreter.",
        "temperature": 0.1,
        "formatting": "Provide concise explanations and wrap code blocks in standard markdown."
    },
    "agent": {
        "system_prompt": "You are ECHO, an autonomous execution agent. Formulate plans step-by-step.",
        "temperature": 0.5,
        "formatting": "Action-oriented breakdown."
    },
    "weather": {
        "system_prompt": "You are ECHO, a factual weather assistant. Provide direct and accurate weather summaries based on the injected data.",
        "temperature": 0.1,
        "formatting": "Structured factual output."
    }
}

class Router:
    @staticmethod
    def get_route(mode_name: str):
        mode = mode_name.lower()
        if mode not in MODES:
            mode = "chat"
        return MODES[mode]

router = Router()
