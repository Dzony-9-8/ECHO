from pathlib import Path
import os

class DependencyGraph:
    def __init__(self):
        self.forward_graph = {} # file -> list of imported files
        self.reverse_graph = {} # file -> list of files importing this one

    def build(self, file_map):
        """
        Builds a bidirectional dependency graph.
        Expects file_map from RepoIndexer (with 'imports' list).
        """
        self.forward_graph = {}
        self.reverse_graph = {file: [] for file in file_map}

        # 1. Resolve imports to actual file paths (best effort)
        for source_file, data in file_map.items():
            resolved_imports = []
            for imp in data.get("imports", []):
                if target_path := self._resolve_import(imp, source_file, file_map):
                    resolved_imports.append(target_path)
            
            self.forward_graph[source_file] = resolved_imports

        # 2. Build reverse graph
        for source_file, targets in self.forward_graph.items():
            for target in targets:
                if target in self.reverse_graph:
                    self.reverse_graph[target].append(source_file)

        return {
            "forward": self.forward_graph,
            "reverse": self.reverse_graph
        }

    def _resolve_import(self, imp_name, source_file, file_map):
        """Attempts to resolve an import string to an absolute file path in the repo."""
        # This is a simplified resolver. It assumes imports match file structure.
        # e.g. 'core.orchestrator' -> 'core/orchestrator.py'
        
        rel_path = imp_name.replace(".", "/") + ".py"
        potential_path = Path(rel_path)
        
        # Try relative to repo root (assuming source_file paths are absolute or relative to same root)
        # In our case, RepoIndexer uses absolute paths.
        
        # Get common root if possible, or assume paths in file_map are representative
        sorted_files = sorted(list(file_map.keys()))
        if not sorted_files:
            return None
            
        repo_root = next(
            (p for p in Path(source_file).parents if p.name == "ai-orchestrator"),
            Path(sorted_files[0]).parent if sorted_files else Path(".")
        )

        full_potential = (repo_root / rel_path).resolve()
        
        # Check if it exists in our index
        return next(
            (fm_path for fm_path in file_map if str(Path(fm_path).resolve()) == str(full_potential)),
            None,
        )

    def find_transitive_impact(self, target_file):
        """Finds all files that depend on target_file, directly or indirectly."""
        impacted = set()
        stack = [target_file]
        
        while stack:
            current = stack.pop()
            if current not in impacted:
                if current != target_file:
                    impacted.add(current)
                
                # Add all files that import this one
                dependents = self.reverse_graph.get(current, [])
                stack.extend(dep for dep in dependents if dep not in impacted)
        
        return list(impacted)
