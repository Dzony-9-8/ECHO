import requests
import json
import time

API_URL = "http://127.0.0.1:8000/v1/chat/completions"

def test_basic_chat():
    print("Testing Basic Chat Mode...")
    payload = {
        "model": "llama3.1:8b",
        "messages": [
            {"role": "user", "content": "Hello, what is your name?"}
        ],
        "mode": "chat",
        "web_enabled": False,
        "rag_enabled": False,
        "research_depth": 0
    }
    
    try:
        response = requests.post(API_URL, json=payload)
        response.raise_for_status()
        data = response.json()
        print("Success! Response:")
        print(json.dumps(data, indent=2))
    except Exception as e:
        print(f"Failed: {e}")
        if 'response' in locals():
            print(response.text)

def test_research_mode():
    print("\nTesting Research Mode...")
    payload = {
        "model": "llama3.1:8b",
        "messages": [
            {"role": "user", "content": "Explain quantum computing briefly."}
        ],
        "mode": "research",
        "web_enabled": True, # will trigger search
        "rag_enabled": False,
        "research_depth": 1
    }
    
    try:
        start = time.time()
        response = requests.post(API_URL, json=payload)
        response.raise_for_status()
        data = response.json()
        print(f"Success! (Took {time.time() - start:.2f}s) Response:")
        print(data['choices'][0]['message']['content'])
    except Exception as e:
        print(f"Failed: {e}")
        if 'response' in locals():
            print(response.text)

def test_hybrid_mode():
    print("\n-----------\nTesting Hybrid Mode (RAG + WEB)...")
    payload = {
        "model": "llama3.1:8b",
        "messages": [
            {"role": "user", "content": "Hello, combined search query."}
        ],
        "mode": "chat",
        "web_enabled": True, 
        "rag_enabled": True,
        "research_depth": 0
    }
    
    try:
        start = time.time()
        response = requests.post(API_URL, json=payload)
        response.raise_for_status()
        data = response.json()
        print(f"Success! (Took {time.time() - start:.2f}s) Response:")
        print(data['choices'][0]['message']['content'])
    except Exception as e:
        print(f"Failed: {e}")
        if 'response' in locals():
            print(response.text)

def test_weather_mode():
    print("\n-----------\nTesting Weather Mode (NLP Intent)...")
    payload = {
        "model": "llama3.1:8b",
        "messages": [
            {"role": "user", "content": "What is the weather like in Tokyo today?"}
        ],
        "mode": "chat",
        "weather_enabled": True
    }
    
    try:
        start = time.time()
        response = requests.post(API_URL, json=payload)
        response.raise_for_status()
        data = response.json()
        print(f"Success! (Took {time.time() - start:.2f}s)")
        print(f"Weather Data Injected: {'weather_data' in data}")
        if 'weather_data' in data:
            print(f"Location: {data['weather_data']['location']}")
            print(f"Temperature: {data['weather_data']['current']['temperature']}")
        print("Response:")
        print(data['choices'][0]['message']['content'])
    except Exception as e:
        print(f"Failed: {e}")
        if 'response' in locals():
            print(response.text)

if __name__ == "__main__":
    test_basic_chat()
    print("-----------------------------------")
    test_research_mode()
    test_hybrid_mode()
    test_weather_mode()
