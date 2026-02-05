import requests
import json
import sys
import os

# Configuration
BASE_URL = "http://127.0.0.1:8000"
USERNAME = "User"

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def chat():
    clear_screen()
    print("-" * 50)
    print("Welcome to ECHO AI - Interactive Console")
    print("Type 'exit', 'quit', or 'clear' to manage memory.")
    print("-" * 50)
    
    # Check if server is online
    try:
        requests.get(BASE_URL, timeout=5)
    except:
        print("\n[ERROR] ECHO is not online! Please run this in another terminal first:")
        print("python -m uvicorn backend.main:app --reload --port 8000")
        return

    while True:
        try:
            # Get user input
            user_input = input(f"\n[{USERNAME}]: ").strip()
            
            if not user_input:
                continue
                
            if user_input.lower() in ['exit', 'quit']:
                print("\nGoodbye!")
                break
                
            if user_input.lower() == 'clear':
                requests.post(f"{BASE_URL}/memory/clear")
                print("\n[SYSTEM] Memory cleared!")
                continue

            # Send to ECHO
            print("\nECHO is thinking...", end="\r")
            response = requests.post(
                f"{BASE_URL}/chat",
                json={"message": user_input, "username": USERNAME},
                timeout=180 # Longer timeout for search/scraping
            )
            
            if response.status_code == 200:
                # Clear the "thinking" line
                sys.stdout.write("\033[K")
                result = response.json()
                print(f"[ECHO]: {result['response']}")
            else:
                print(f"\n[ERROR] Server returned error: {response.status_code}")
                
        except KeyboardInterrupt:
            print("\n\nGoodbye!")
            break
        except Exception as e:
            print(f"\n[ERROR] {str(e)}")

if __name__ == "__main__":
    chat()
