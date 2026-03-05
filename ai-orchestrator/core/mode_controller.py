import yaml
import os

class ModeController:
    def __init__(self):
        self.manual_override = None
        self.current_mode_name = "assistant"
        self.current_config = {}
        self.load_mode("assistant")

    def load_mode(self, mode_name: str):
        """Loads a mode configuration from YAML."""
        path = f"config/modes/{mode_name}.yaml"
        try:
            with open(path, "r") as f:
                self.current_config = yaml.safe_load(f)
            self.current_mode_name = mode_name
            return self.current_config
        except Exception as e:
            print(f"--- Error: Could not load mode config {mode_name}: {e} ---")
            # Minimal fallback if YAML load fails
            self.current_config = {"mode": "assistant", "tool_access": [], "max_iterations": 1}
            return self.current_config

    def set_manual(self, mode_name: str):
        """Sets a high-priority manual override."""
        if os.path.exists(f"config/modes/{mode_name}.yaml"):
            self.manual_override = mode_name
            return True
        return False

    def resolve_mode(self, auto_detected_mode: str):
        """Prioritizes manual override over auto-detection."""
        mode_to_use = self.manual_override or auto_detected_mode
        return self.load_mode(mode_to_use)

    def filter_tools(self, plan):
        """Removes tool calls that are not permitted in the current mode."""
        if not hasattr(plan, 'tool_calls') or not plan.tool_calls:
            return plan

        tool_access = self.current_config.get("tool_access", [])
        allowed_calls = [
            t for t in plan.tool_calls
            if t.get("tool") in tool_access
        ]
        
        if len(allowed_calls) < len(plan.tool_calls):
            print(f"--- Mode Controller: Filtered out {len(plan.tool_calls) - len(allowed_calls)} unauthorized tool calls for mode '{self.current_mode_name}' ---")
            plan.tool_calls = allowed_calls
            
        return plan

    def adjust_loop(self, agent_loop):
        """Configures the agent loop based on mode parameters."""
        agent_loop.max_iters = self.current_config.get("max_iterations", 1)
