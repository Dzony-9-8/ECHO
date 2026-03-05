@echo off
cd /d "%~dp0"
echo Creating venv with Python 3.12 (required for llama-cpp-python wheels)...
if exist venv (
    echo Removing existing venv...
    rmdir /s /q venv 2>nul
)
py -3.12 -m venv venv
if errorlevel 1 (
    echo.
    echo py -3.12 not found. Install Python 3.12 from https://www.python.org/downloads/
    echo Or run manually with your Python 3.12 path, e.g.:
    echo   "C:\Path\To\Python312\python.exe" -m venv venv
    pause
    exit /b 1
)
call venv\Scripts\activate.bat
echo Installing dependencies (CUDA wheel)...
pip install -r requirements-cuda.txt
if errorlevel 1 (
    echo Try CPU instead: pip install -r requirements-cpu.txt
    pause
    exit /b 1
)
echo.
echo Done. Run: venv\Scripts\activate.bat   then   python main.py
echo Or double-click run.bat
pause
