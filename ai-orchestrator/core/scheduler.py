import asyncio
import time
from typing import Callable, Coroutine, Any

class BackgroundScheduler:
    def __init__(self, orchestrator):
        self.orchestrator = orchestrator
        self.tasks = []
        self.is_running = False

    def add_task(self, name: str, interval_sec: int, task_func: Callable[[], Coroutine[Any, Any, None]]):
        """Add a recurring asynchronous task."""
        self.tasks.append({
            "name": name,
            "interval": interval_sec,
            "func": task_func,
            "last_run": 0
        })
        print(f"--- Scheduler: Registered task '{name}' (every {interval_sec}s) ---")

    async def start(self):
        """Start the background processing loop."""
        self.is_running = True
        print("--- Background Scheduler Started ---")
        while self.is_running:
            now = time.time()
            for task in self.tasks:
                if now - task["last_run"] >= task["interval"]:
                    # Run the task proactively
                    print(f"--- Scheduler: Starting background task '{task['name']}' ---")
                    task["last_run"] = now
                    # We run it in a separate task to avoid blocking the scheduler
                    asyncio.create_task(self._run_task(task))
            
            await asyncio.sleep(1)

    async def _run_task(self, task):
        try:
            await task["func"]()
            print(f"--- Scheduler: Task '{task['name']}' completed successfully ---")
        except Exception as e:
            print(f"--- ERROR in background task '{task['name']}': {e} ---")

    def stop(self):
        self.is_running = False
