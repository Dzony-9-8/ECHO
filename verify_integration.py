import requests
import json
import time

BASE_URL = "http://127.0.0.1:8002"

def test_chat():
    print(f"Testing Chat Endpoint at {BASE_URL}...")
    
    # 1. Test Neutral/Info Query (should trigger search)
    msg1 = "What is the weather in Tokyo?"
    print(f"\nSending: '{msg1}'")
    try:
        start = time.time()
        response = requests.post(f"{BASE_URL}/chat", json={"message": msg1}, timeout=120)
        end = time.time()
        print(f"Time taken: {end - start:.2f}s")
        
        if response.status_code == 200:
            data = response.json()
            print("Response:", json.dumps(data, indent=2))
            assert "emotion" in data
            assert "confidence" in data
            assert "response" in data
            print("TEST 1 PASSED (Structure)")
        else:
            print(f"TEST 1 FAILED: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"TEST 1 FAILED with error: {e}")

    # 2. Test Emotional Query
    msg2 = "I'm feeling really sad today."
    print(f"\nSending: '{msg2}'")
    try:
        response = requests.post(f"{BASE_URL}/chat", json={"message": msg2}, timeout=60)
        if response.status_code == 200:
            data = response.json()
            print("Response:", json.dumps(data, indent=2))
            assert data['emotion'] in ['negative', 'very_negative']
            print("TEST 2 PASSED (Emotion Detection)")
        else:
             print(f"TEST 2 FAILED: {response.status_code}")
    except Exception as e:
        print(f"TEST 2 FAILED with error: {e}")

if __name__ == "__main__":
    test_chat()
