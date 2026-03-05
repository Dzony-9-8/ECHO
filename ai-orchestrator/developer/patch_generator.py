import difflib

class PatchGenerator:
    def generate_patch(self, original, modified, file_path):
        """Generates a unified diff between original and modified content."""
        diff = difflib.unified_diff(
            original.splitlines(),
            modified.splitlines(),
            fromfile=f"{file_path} (original)",
            tofile=f"{file_path} (modified)",
            lineterm=""
        )
        return "\n".join(diff)
