import time
import os
import sys

# Add parent dir to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from developer.core import DeveloperCore

class DevDaemon:
    def __init__(self, core):
        self.core = core
        self.last_state = {}

    def scan_changes(self):
        """Scans for file system changes and re-indexes if necessary."""
        # Simple throttling check
        if hasattr(self.core, 'orchestrator') and self.core.orchestrator.telemetry:
            stats = self.core.orchestrator.telemetry.get_stats()
            if stats['cpu_percent'] > 70 or stats['ram']['used_percent'] > 85:
                print(f"[{time.strftime('%H:%M:%S')}] High system load. Throttling daemon scan...")
                return True # Signal that we throttled
        
        current_files = self.core.indexer.index()
        # Simple size+count check for now
        current_hash = {path: data['size'] for path, data in current_files.items()}
        
        if current_hash != self.last_state:
            print(f"[{time.strftime('%H:%M:%S')}] Repo changed. Re-indexing...")
            self.core.initialize()
            self.last_state = current_hash
            print(f"[{time.strftime('%H:%M:%S')}] Re-index complete. Serving {len(current_hash)} files.")
        return False

    def run(self, interval=10):
        print(f"--- ECHO Developer Daemon Started (Interval: {interval}s) ---")
        print(f"Monitoring: {self.core.repo_path}")
        try:
            while True:
                throttled = self.scan_changes()
                actual_interval = interval * 3 if throttled else interval
                time.sleep(actual_interval)
        except KeyboardInterrupt:
            print("--- Daemon Stopped ---")

if __name__ == "__main__":
    from developer.core import DeveloperCore
    repo = os.path.abspath(".")
    core = DeveloperCore(repo)
    core.initialize()
    daemon = DevDaemon(core)
    daemon.run()
