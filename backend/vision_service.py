# vision_service.py
import base64
import requests
import logging

class VisionService:
    def __init__(self, llm_client):
        self.llm_client = llm_client
        self.vision_model = "llava" # Standard open vision model
        self._is_available = None

    def check_availability(self):
        """Check if the vision model (llava) is available."""
        if self._is_available is not None:
            return self._is_available
            
        try:
            # Simple check via tags
            response = requests.get("http://127.0.0.1:11434/api/tags")
            if response.status_code == 200:
                models = [m['name'] for m in response.json().get('models', [])]
                # Check for llava or any variant
                self._is_available = any('llava' in m for m in models)
                return self._is_available
        except:
            pass
        
        return False

    def analyze_image(self, image_base64, prompt="Describe this image in detail.", stream=True):
        """
        Analyze an image using the vision model.
        Returns a generator if stream=True, else string.
        """
        if not self.check_availability():
            yield "[SYSTEM]: Vision model (llava) is not installed. Please run `ollama pull llava` to enable vision capabilities."
            return

        # Use the LLMClient to send the request, overriding the model to llava
        return self.llm_client.generate_response(
            prompt=prompt,
            images=[image_base64],
            model=self.vision_model,
            stream=stream
        )
