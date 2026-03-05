import subprocess

class GitManager:
    def create_branch(self, name):
        """Creates a new git branch."""
        print(f"--- Developer Profile: Creating git branch '{name}' ---")
        subprocess.run(["git", "checkout", "-b", name], check=False)

    def commit(self, message):
        """Stages and commits all changes."""
        print(f"--- Developer Profile: Committing changes - '{message}' ---")
        subprocess.run(["git", "add", "."], check=False)
        subprocess.run(["git", "commit", "-m", message], check=False)
