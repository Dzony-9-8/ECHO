class RefactorAgent:
    def rename_function(self, file_map, old_name, new_name):
        """Performs a global rename of a function/symbol across the codebase."""
        print(f"--- Developer Profile: Renaming symbol '{old_name}' to '{new_name}' ---")
        patches = []
        for file_path in file_map:
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                if old_name in content:
                    modified = content.replace(old_name, new_name)
                    # Note: We return content here for PatchGenerator to use later
                    patches.append((file_path, content, modified))
            except Exception as e:
                print(f"--- Warning: Refactor failed for {file_path}: {e} ---")
        return patches
