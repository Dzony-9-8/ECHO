import re
from ..config import DEFAULT_LOCATION

class IntentDetector:
    def __init__(self):
        self.weather_keywords = [
            "weather", "temperature", "forecast", "rain", 
            "snow", "wind", "humidity", "how cold", "how hot"
        ]

    def detect_weather_intent(self, text: str):
        text_lower = text.lower()
        
        # Fast exit if no keyword is present
        if not any(keyword in text_lower for keyword in self.weather_keywords):
            return None
            
        # Basic NLP parsing for location:
        # e.g., "weather in Belgrade", "temperature for Paris", "is it raining in Tokyo"
        location = DEFAULT_LOCATION
        
        match = re.search(r'(?:in|for|at)\s+([a-zA-Z\s]+)(?:today|tomorrow|this|un|\?|\.|$)', text_lower)
        if match:
            extracted = match.group(1).strip()
            # Minimal cleanup to avoid capturing trailing stop words
            for stop in ["today", "tomorrow", "this", "the"]:
                if extracted.endswith(f" {stop}"):
                    extracted = extracted[:-(len(stop)+1)]
            if extracted:
                location = extracted.title()
                
        return location

intent_detector = IntentDetector()
