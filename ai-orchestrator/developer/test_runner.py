import subprocess
import os

class TestRunner:
    def __init__(self, root_dir: str):
        self.root_dir = root_dir

    def run_tests(self):
        """Discovers and executes tests using pytest."""
        print(f"--- Developer Profile: Running tests in {self.root_dir} ---")
        try:
            result = subprocess.run(
                ["pytest", self.root_dir],
                capture_output=True,
                text=True,
                check=False
            )
            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exit_code": result.returncode
            }
        except Exception as e:
            return {"error": str(e)}
