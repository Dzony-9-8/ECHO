import sys
import asyncio
from core.orchestrator import Orchestrator


async def main() -> None:
    orchestrator = Orchestrator()

    print("\nLocal AI Orchestrator Ready (Profile-Based Runtime).")
    print("Type 'exit' to quit. Use /profile <name> to switch.")
    print("Available profiles: assistant, developer, research, os_runtime\n")

    while True:
        try:
            user_input = input("You: ")
            if not user_input.strip():
                continue
            if user_input.strip().lower() == "exit":
                break

            # CLI Profile Switching
            if user_input.startswith("/profile"):
                try:
                    parts = user_input.split()
                    if len(parts) > 1:
                        new_profile = parts[1]
                        if orchestrator.switch_mode(new_profile): # Kept switch_mode for compat or rename it
                            print(f"--- Active Profile set to: {new_profile} ---")
                        else:
                            print(f"--- Error: Profile '{new_profile}' not found ---")
                    else:
                        print("--- Usage: /profile <assistant|developer|research|os_runtime> ---")
                except Exception as e_cmd:
                    print(f"--- Error: {e_cmd} ---")
                continue

            await orchestrator.process(user_input)
            
        except KeyboardInterrupt:
            break
        except Exception as e_loop:
            print(f"\n--- ERROR: {e_loop} ---\n")

    print("Goodbye.")


if __name__ == "__main__":
    asyncio.run(main())
