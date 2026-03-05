import os
from pathlib import Path
from developer.ast_parser import ASTParser

class RepoIndexer:
    def __init__(self, root_path):
        self.root = Path(root_path)
        self.parser = ASTParser()
        self.file_map = {}

    def index(self):
        """Builds a deep structural index of the repository."""
        print(f"--- Developer Profile: Deep Indexing {self.root} ---")
        for root, dirs, files in os.walk(self.root):
            # Optimization: Skip venv and common ignore dirs
            dirs[:] = [d for d in dirs if d not in ["venv", ".git", "__pycache__", ".venv", "env"]]
            
            for file in files:
                if file.endswith(".py"):
                    path = Path(root) / file
                    parsed = self.parser.parse(path)
            self.file_map[str(path)] = {
                "size": path.stat().st_size,
                "imports": parsed["imports"],
                "functions": parsed["functions"],
                "classes": parsed["classes"]
            }
        return self.file_map
