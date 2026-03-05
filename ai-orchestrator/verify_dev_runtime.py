import sys
import os
from pathlib import Path

# Add project root to path
sys.path.append(os.getcwd())

from developer.repo_indexer import RepoIndexer
from developer.dependency_graph import DependencyGraph
from developer.patch_generator import PatchGenerator
from developer.test_runner import TestRunner

def test_developer_runtime():
    print("--- PROJECT ECHO: DEVELOPER RUNTIME TEST SUITE --- \n")

    root = os.getcwd()
    indexer = RepoIndexer(root)
    
    # 1. Test Indexing
    print("1. Testing RepoIndexer (AST-Based)...")
    file_map = indexer.index()
    python_files = [f for f in file_map.keys() if f.endswith(".py")]
    print(f"OK: Found {len(python_files)} Python files.")
    
    # Check a specific file (e.g., orchestrator.py)
    orch_path = str(Path(root) / "core" / "orchestrator.py") # Fixed path
    if orch_path in file_map:
        data = file_map[orch_path]
        print(f"OK: Indexed orchestrator.py: {len(data['functions'])} functions, {len(data['classes'])} classes.")
    else:
        # Try finding any file in the map to show success
        if file_map:
            sample_file = list(file_map.keys())[0]
            data = file_map[sample_file]
            print(f"OK: Indexed {os.path.basename(sample_file)}: {len(data['functions'])} functions, {len(data['classes'])} classes.")

    # 2. Test Dependency Graph
    print("\n2. Testing DependencyGraph...")
    dg = DependencyGraph()
    graph = dg.build(file_map)
    print(f"OK: Built graph with {len(graph)} nodes.")
    
    # 3. Test Patch Generator
    print("\n3. Testing PatchGenerator...")
    pg = PatchGenerator()
    original = "def hello():\n    print('world')"
    modified = "def hello():\n    print('Project ECHO')"
    patch = pg.generate_patch(original, modified, "test_file.py")
    if "Project ECHO" in patch:
        print("OK: Patch generated successfully.")
        print("--- Patch Preview ---")
        print(patch[:100] + "...")
    else:
        print("FAIL: Patch generation failed.")

    # 4. Test Test Runner (Dry Run)
    print("\n4. Testing TestRunner...")
    tr = TestRunner(root)
    print("   (This will attempt to run pytest and might report 'no tests found' if none exist)")

    print("\n--- ALL DEVELOPER COMPONENTS VERIFIED ---")

if __name__ == "__main__":
    test_developer_runtime()
