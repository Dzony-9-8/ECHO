"""
ECHO V3 — Weather Tool Wrapper
Wraps backend/core/weather_engine.py behind the standard Tool interface.
Logic lives in weather_engine.py; this is just the orchestrator-facing shell.
"""

from .base import Tool
from ..core.weather_engine import weather_engine

class WeatherTool(Tool):
    name = "get_weather"
    description = "Fetches current weather and 7-day forecast for a location using Open-Meteo."

    def execute(self, input_data: dict) -> dict:
        location = input_data.get("location", "Belgrade")
        data = weather_engine.get_weather(location)
        if "error" in data:
            return {"result": None, "error": data["error"]}
        return {"result": data, "error": None}
