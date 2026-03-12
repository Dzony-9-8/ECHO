import requests
import json
from datetime import datetime, timedelta
from ..config import ENABLE_WEATHER, WEATHER_CACHE_TTL
from ..database.models import SessionLocal, WeatherCache

class WeatherEngine:
    def __init__(self):
        self.enabled = ENABLE_WEATHER

    def _get_from_cache(self, location: str):
        db = SessionLocal()
        try:
            cutoff = datetime.utcnow() - timedelta(seconds=WEATHER_CACHE_TTL)
            cached = db.query(WeatherCache).filter(
                WeatherCache.location == location.lower(),
                WeatherCache.timestamp >= cutoff
            ).first()
            if cached:
                return json.loads(cached.json_data)
        finally:
            db.close()
        return None

    def _save_to_cache(self, location: str, data: dict):
        db = SessionLocal()
        try:
            # Delete older entries for this location
            db.query(WeatherCache).filter(WeatherCache.location == location.lower()).delete()
            
            new_cache = WeatherCache(
                location=location.lower(),
                json_data=json.dumps(data)
            )
            db.add(new_cache)
            db.commit()
        except Exception as e:
            print(f"Failed to cache weather: {e}")
        finally:
            db.close()

    def get_weather(self, location: str):
        if not self.enabled:
            return {"error": "Weather engine is disabled in configuration."}
        
        cached_data = self._get_from_cache(location)
        if cached_data:
            return cached_data

        try:
            # 1. Geocoding
            geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={location}&count=1&language=en&format=json"
            geo_resp = requests.get(geo_url, timeout=10)
            geo_resp.raise_for_status()
            geo_data = geo_resp.json()
            
            if not geo_data.get("results"):
                return {"error": f"Could not find location: {location}"}
                
            city_data = geo_data["results"][0]
            lat = city_data["latitude"]
            lon = city_data["longitude"]
            city_name = city_data.get("name", location)

            # 2. Weather Fetch
            weather_url = (
                f"https://api.open-meteo.com/v1/forecast?"
                f"latitude={lat}&longitude={lon}&"
                f"current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m&"
                f"daily=weather_code,temperature_2m_max,temperature_2m_min&"
                f"timezone=auto"
            )
            weather_resp = requests.get(weather_url, timeout=10)
            weather_resp.raise_for_status()
            w_data = weather_resp.json()
            
            current = w_data.get("current", {})
            daily = w_data.get("daily", {})

            # Format forecast
            forecast_list = []
            if daily and "time" in daily:
                for i in range(len(daily["time"])):
                    forecast_list.append({
                        "date": daily["time"][i],
                        "weathercode": daily["weather_code"][i],
                        "temp_max": daily["temperature_2m_max"][i],
                        "temp_min": daily["temperature_2m_min"][i]
                    })

            def get_weather_desc(code):
                mapping = {
                    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
                    45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
                    56: "Light freezing drizzle", 57: "Dense freezing drizzle", 61: "Slight rain", 63: "Moderate rain",
                    65: "Heavy rain", 66: "Light freezing rain", 67: "Heavy freezing rain", 71: "Slight snow fall",
                    73: "Moderate snow fall", 75: "Heavy snow fall", 77: "Snow grains", 80: "Slight rain showers",
                    81: "Moderate rain showers", 82: "Violent rain showers", 85: "Slight snow showers", 86: "Heavy snow showers",
                    95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
                }
                return mapping.get(code, "Unknown condition")

            result = {
                "location": city_name,
                "current": {
                    "temperature": current.get("temperature_2m"),
                    "weathercode": current.get("weather_code"),
                    "description": get_weather_desc(current.get("weather_code", -1)),
                    "windspeed": current.get("wind_speed_10m"),
                    "winddirection": current.get("wind_direction_10m")
                },
                "forecast": forecast_list
            }

            self._save_to_cache(location, result)
            return result

        except requests.exceptions.RequestException as e:
            return {"error": f"Failed to fetch weather data: {str(e)}"}
        except Exception as e:
            return {"error": f"An unexpected error occurred: {str(e)}"}

weather_engine = WeatherEngine()
