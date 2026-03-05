class TaskSpawner:
    def __init__(self, orchestrator):
        self.orchestrator = orchestrator

    async def spawn_subtask(self, task_description: str):
        """Spawns a recursive sub-task for deep analysis."""
        print(f"--- Research Profile: Spawning sub-task: '{task_description}' ---")
        # In a real implementation, this would create a new Orchestrator instance
        # or a lightweight Agent to process the subtask independently.
        return await self.orchestrator.process(task_description, skip_confirmation=True)
