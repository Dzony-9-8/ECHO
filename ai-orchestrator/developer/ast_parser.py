import ast

class ASTParser:
    def parse(self, file_path):
        """Extracts imports, functions, and classes from a Python file."""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                tree = ast.parse(f.read())

            result = {
                "imports": [],
                "functions": [],
                "classes": []
            }

            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        result["imports"].append(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    result["imports"].append(node.module)
                elif isinstance(node, ast.FunctionDef):
                    result["functions"].append(node.name)
                elif isinstance(node, ast.ClassDef):
                    result["classes"].append(node.name)
            return result
        except Exception as e:
            print(f"--- Warning: AST Parsing failed for {file_path}: {e} ---")
            return {"imports": [], "functions": [], "classes": []}
