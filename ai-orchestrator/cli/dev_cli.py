import argparse
import sys
import os

# Add parent dir to path so we can import developer
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from developer.core import DeveloperCore

def main():
    parser = argparse.ArgumentParser(description="ECHO Developer Core CLI")
    parser.add_argument("--repo", default=".", help="Path to the repository")
    parser.add_argument("--objective", help="Generate a plan for an objective")
    parser.add_argument("--index", action="store_true", help="Run full project indexing")
    parser.add_argument("--test", action="store_true", help="Run test suite")

    args = parser.parse_args()

    core = DeveloperCore(os.path.abspath(args.repo))
    
    print(f"--- ECHO Developer CLI Initializing on {args.repo} ---")
    file_map = core.initialize()
    
    if args.index:
        print(f"Indexed {len(file_map)} files.")
        for path in file_map:
            print(f" - {os.path.relpath(path, args.repo)}")

    if args.objective:
        plan = core.plan_change(args.objective)
        print("\n--- GENERATED PLAN ---")
        print(f"Objective: {plan['objective']}")
        print("Steps:")
        for i, step in enumerate(plan['steps'], 1):
            print(f"  {i}. {step}")

    if args.test:
        print("\n--- RUNNING TESTS ---")
        results = core.run_suite()
        print(results["output"])

if __name__ == "__main__":
    main()
