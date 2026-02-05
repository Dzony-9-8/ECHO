"""
Test script for ECHO AI information gathering capabilities.
Run various queries to test search, scraping, and response quality.
"""

import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def test_chat(message, description):
    """Send a chat message and print the response."""
    print(f"\n{'='*80}")
    print(f"TEST: {description}")
    print(f"{'='*80}")
    print(f"Query: {message}")
    print("-" * 80)
    
    try:
        response = requests.post(
            f"{BASE_URL}/chat",
            json={"message": message, "username": "Tester"},
            timeout=120
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"Response: {result['response']}")
            print(f"Status: [SUCCESS]")
        else:
            print(f"Status: [FAILED] - HTTP {response.status_code}")
            print(f"Error: {response.text}")
    
    except requests.exceptions.Timeout:
        print(f"Status: [TIMEOUT] - Request took longer than 60 seconds")
    except Exception as e:
        print(f"Status: [ERROR] - {str(e)}")
    
    print("=" * 80)
    time.sleep(2)  # Brief pause between tests

def main():
    print("\nECHO AI - Information Gathering Capability Tests")
    print("=" * 80)
    
    # Test 1: Conversational (should NOT trigger search)
    test_chat(
        "Hello! How are you doing today?",
        "Conversational Query (No Search Expected)"
    )
    
    # Test 2: Factual Information (should trigger search)
    test_chat(
        "What is the population of Tokyo in 2024?",
        "Factual Query (Search Expected)"
    )
    
    print("\n[SUCCESS] All tests completed!")
    print("\nNote: Review responses to verify:")
    print("  - Search decisions are appropriate")
    print("  - Responses include citations when searched")
    print("  - Personality is natural and conversational")
    print("  - Information is accurate and well-formatted")

if __name__ == "__main__":
    main()
