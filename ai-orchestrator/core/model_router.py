import os

# Load .env file if present (no extra deps needed)
_env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _v = _line.split("=", 1)
                os.environ.setdefault(_k.strip(), _v.strip())

class ModelRouter:
    """Decides which model to use based on the task context."""

    def __init__(self):
        # Configuration for local models (llama-cpp-python usually)
        self.local_chat_model = "llama-3.1-8b"
        self.local_coder_model = "deepseek-coder-v2"
        
        # Configuration for cloud reasoning
        self.cloud_reasoning_model = "deepseek-r1"
        self.api_key = os.getenv("DEEPSEEK_API_KEY", "")

    def route(self, message, profile="assistant", is_planning=False):
        """
        Determines the optimal model for the given prompt.
        
        Rules:
        - If profile is 'developer' and it's a coding task -> DeepSeek-Coder (Local)
        - If it's a multi-file planning objective or 'research' profile -> DeepSeek-R1 (Cloud)
        - Basic conversation or orchestration -> LLaMA 3.1 (Local)
        """
        
        # 1. Strategic Reasoning — only go to cloud if we have a real key
        has_api_key = bool(self.api_key and len(self.api_key) > 8)
        if has_api_key and (is_planning or profile == "research"):
            print(f"--- Routing to CLOUD REASONING ({self.cloud_reasoning_model}) ---")
            return {
                "engine": "cloud",
                "model": self.cloud_reasoning_model,
                "api_key": self.api_key
            }

        # 2. Coding Specialist (Local)
        if profile == "developer":
            print(f"--- Routing to LOCAL CODER ({self.local_coder_model}) ---")
            return {
                "engine": "local",
                "model": self.local_coder_model
            }

        # 3. Default Orchestration/Chat (Local) — also fallback when no API key
        print(f"--- Routing to LOCAL CHAT ({self.local_chat_model}) ---")
        return {
            "engine": "local",
            "model": self.local_chat_model
        }
