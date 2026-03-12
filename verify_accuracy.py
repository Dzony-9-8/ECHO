import requests
import json
from datetime import datetime

url = "http://127.0.0.1:8001/chat"
query = "What is the current weather in Tokyo or Anchorage? Please provide exact numbers from the real-time API."

print(f"[{datetime.now()}] Sending request...")
try:
    response = requests.post(url, json={"message": query, "username": "Dzo"}, timeout=120)
    print(f"[{datetime.now()}] Response received!")
    print(f"Status Code: {response.status_code}")
    # Encode to bytes and then decode safely for the terminal if needed, 
    # but printing should work if we handle it carefully.
    content = response.json()['response']
    print(f"Response: {content.encode('ascii', 'ignore').decode('ascii')}")
    print("\nFull response with symbols (as bytes):")
    print(content.encode('utf-8'))
except Exception as e:
    print(f"Error: {e}")

