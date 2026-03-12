"""
Dedicated weather lookups for ECHO AI using Open-Meteo API.
Provides real-time, highly accurate weather data without requiring API keys.
"""

import requests
from typing import Dict, Optional

def get_weather(location_name: str) -> Dict:
    """
    Get real-time weather for a city name.
    
    Args:
        location_name: Name of the city/location
        
    Returns:
        Dict with weather data or error message
    """
    try:
        # 1. Geocoding: Get coordinates for the location
        geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={location_name}&count=1&language=en&format=json"
        geo_response = requests.get(geo_url, timeout=10)
        geo_response.raise_for_status()
        
        geo_data = geo_response.json()
        if not geo_data.get('results'):
            return {"success": False, "error": f"Could not find coordinates for '{location_name}'."}
        
        loc = geo_data['results'][0]
        lat = loc['latitude']
        lon = loc['longitude']
        full_name = f"{loc.get('name')}, {loc.get('admin1', '')}, {loc.get('country', '')}"
        
        # 2. Weather: Get current weather using coordinates
        weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&temperature_unit=celsius&wind_speed_unit=kmh"
        weather_response = requests.get(weather_url, timeout=10)
        weather_response.raise_for_status()
        
        weather_data = weather_response.json()
        current = weather_data.get('current_weather', {})
        
        # Map weather codes to descriptions (basic mapping)
        # 0: Clear, 1-3: Partly Cloudy, 45-48: Fog, 51-67: Rain/Drizzle, 71-77: Snow, 80-82: Showers, 95-99: Thunderstorm
        code = current.get('weathercode', 0)
        desc = "Clear skies"
        if code in [1, 2, 3]: desc = "Partly cloudy"
        elif code in [45, 48]: desc = "Foggy"
        elif code in [51, 53, 55]: desc = "Light drizzle"
        elif code in [61, 63, 65]: desc = "Rain"
        elif code in [71, 73, 75]: desc = "Snowing"
        elif code in [80, 81, 82]: desc = "Rain showers"
        elif code in [95, 96, 99]: desc = "Thunderstorm"
        
        return {
            "success": True,
            "location": full_name,
            "temperature": current.get('temperature'),
            "wind_speed": current.get('windspeed'),
            "description": desc,
            "units": {"temp": "°C", "wind": "km/h"}
        }
        
    except Exception as e:
        return {"success": False, "error": f"Weather lookup failed: {str(e)}"}

def format_weather_for_echo(weather_data: Dict) -> str:
    """Format weather data into a text block for ECHO's context."""
    if not weather_data.get('success'):
        return f"Weather Info: {weather_data.get('error', 'Unknown error')}"
        
    w = weather_data
    return (
        f"=== REAL-TIME WEATHER DATA ===\n"
        f"Location: {w['location']}\n"
        f"Current Temperature: {w['temperature']}{w['units']['temp']}\n"
        f"Conditions: {w['description']}\n"
        f"Wind Speed: {w['wind_speed']} {w['units']['wind']}\n"
        f"Note: This is direct API data, prioritize this over search snippets.\n"
        f"==============================\n"
    )
