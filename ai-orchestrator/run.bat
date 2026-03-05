@echo off
cd /d "%~dp0"
if not exist "venv\Scripts\activate.bat" (
    echo Creating venv...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo Ensuring dependencies (CPU prebuilt wheel)...
pip install -r requirements-cpu.txt
REM For GPU: pip install -r requirements-cuda.txt
python main.py
pause
