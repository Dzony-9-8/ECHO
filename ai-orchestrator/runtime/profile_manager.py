class ProfileManager:
    def __init__(self):
        self._active_profile = None
        self._profiles = {}

    def register(self, name: str, profile_instance):
        """Registers a runtime profile instance."""
        self._profiles[name] = profile_instance
        print(f"--- Profile Manager: Registered '{name}' ---")

    def activate(self, name: str, core):
        """Activates a profile and applies its configuration to the core."""
        if profile := self._profiles.get(name):
            profile.configure(core)
            self._active_profile = profile
            print(f"--- Profile Manager: '{name}' activated ---")
            return profile
        print(f"--- Error: Profile '{name}' not found ---")
        return None

    def current(self):
        """Returns the active profile."""
        return self._active_profile
