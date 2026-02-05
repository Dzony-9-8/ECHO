import sys
import io
import contextlib
import multiprocessing
import queue
import time

def execute_code_internal(code: str, result_queue: multiprocessing.Queue):
    """
    Inner function that runs the code and captures output.
    This runs in a separate process for isolation.
    """
    # Create a string buffer to capture stdout/stderr
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()
    
    # Restrict globals if needed (basic version)
    safe_globals = {
        "__builtins__": __builtins__,
        "print": print,
        "range": range,
        "len": len,
        "list": list,
        "dict": dict,
        "set": set,
        "int": int,
        "float": float,
        "str": str,
        "bool": bool,
        "abs": abs,
        "sum": sum,
        "min": min,
        "max": max,
        "enumerate": enumerate,
        "zip": zip,
        "round": round,
        "divmod": divmod,
        "pow": pow,
        "math": __import__('math'),
        "datetime": __import__('datetime'),
        "json": __import__('json'),
        "re": __import__('re'),
        "random": __import__('random'),
        "time": __import__('time'),
        "chess": __import__('chess'),
    }

    try:
        with contextlib.redirect_stdout(stdout_capture), contextlib.redirect_stderr(stderr_capture):
            # Execute the code
            exec(code, safe_globals)
        
        result_queue.put({
            "success": True,
            "stdout": stdout_capture.getvalue(),
            "stderr": stderr_capture.getvalue()
        })
    except Exception as e:
        result_queue.put({
            "success": False,
            "stdout": stdout_capture.getvalue(),
            "stderr": str(e)
        })

class CodeInterpreter:
    """
    Executes Python code in a safe, isolated process.
    """
    def __init__(self, timeout_seconds: int = 5):
        self.timeout_seconds = timeout_seconds

    def run(self, code: str) -> dict:
        """
        Runs the provided code and returns the results.
        """
        result_queue = multiprocessing.Queue()
        p = multiprocessing.Process(target=execute_code_internal, args=(code, result_queue))
        
        start_time = time.time()
        p.start()
        
        try:
            # Wait for execution or timeout
            result = result_queue.get(timeout=self.timeout_seconds)
            p.join()
            return result
        except queue.Empty:
            # If we timed out, kill the process
            p.terminate()
            p.join()
            return {
                "success": False,
                "stdout": "",
                "stderr": f"Execution timed out after {self.timeout_seconds} seconds."
            }
        except Exception as e:
            if p.is_alive():
                p.terminate()
                p.join()
            return {
                "success": False,
                "stdout": "",
                "stderr": f"Error during execution: {str(e)}"
            }

if __name__ == "__main__":
    # Quick test
    interpreter = CodeInterpreter()
    test_code = """
print('Hello from the sandbox!')
x = 10 * 5
print(f'Result: {x}')
"""
    print("Testing Code Interpreter...")
    result = interpreter.run(test_code)
    print(f"Success: {result['success']}")
    print(f"Stdout:\n{result['stdout']}")
    print(f"Stderr:\n{result['stderr']}")
