from abc import ABC, abstractmethod

class LLMAdapter(ABC):
    @abstractmethod
    def generate(self, messages, temperature=0.7, images=None, model=None, **kwargs):
        """
        Generates a complete response synchronously.
        kwargs may include:
          - resource_profile: str  ("low" | "balanced" | "high") from system_monitor
        """
        pass
    
    @abstractmethod
    def generate_stream(self, messages, temperature=0.7, images=None, model=None, **kwargs):
        """
        Generates a tokenized stream.
        """
        pass
