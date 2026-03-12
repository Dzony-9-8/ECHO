import requests
import json
import time

BASE_URL = "http://127.0.0.1:8002"

def test_precision():
    print(f"Testing Precision improvement at {BASE_URL}...")
    
    # Test query that previously failed to get specific results
    msg = "can you tell me with who did football club 'FK Crvena zvezda' play last and what was the result?"
    print(f"\nSending: '{msg}'")
    
    payload = {
        "message": msg,
        "session_id": "test_precision_session"
    }
    
    try:
        start = time.time()
        response = requests.post(f"{BASE_URL}/chat", json=payload, timeout=120)
        end = time.time()
        print(f"Time taken: {end - start:.2f}s")
        
        if response.status_code == 200:
            data = response.json()
            print("Response:", data['response'])
            # Check for key facts from the ChatGPT screenshot
            if "Celta" in data['response'] or "1-1" in data['response']:
                print("TEST PASSED: Found the match result!")
            else:
                print("TEST FAILED: Result not specific enough.")
        else:
            print(f"Error: {response.status_code}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_precision()
