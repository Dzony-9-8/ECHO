from backend.weather_tool import get_weather, format_weather_for_echo

def test_weather(city):
    print(f"Testing weather for: {city}")
    data = get_weather(city)
    formatted = format_weather_for_echo(data)
    print(formatted)

if __name__ == "__main__":
    test_weather("Tokyo")
    test_weather("Anchorage")
