@echo off
cd /d "%~dp0"
echo Checking Python version (need 3.10, 3.11 or 3.12 for prebuilt wheels)...
if not exist venv\Scripts\python.exe (
    echo venv not found. Create it first:
    echo   py -3.12 -m venv venv
    pause
    exit /b 1
)
venv\Scripts\python.exe -c "import sys; v=sys.version_info; exit(0 if (v.major,v.minor) in ((3,10),(3,11),(3,12)) else 1)"
if errorlevel 1 (
    echo.
    echo This venv is not Python 3.10/3.11/3.12. Prebuilt wheels require that.
    echo Recreate the venv with Python 3.12:
    echo   Remove-Item -Recurse -Force venv
    echo   py -3.12 -m venv venv
    echo   venv\Scripts\activate.bat
    echo Then run this script again.
    pause
    exit /b 1
)
call venv\Scripts\activate.bat
echo Installing llama-cpp-python from CUDA wheel (no build)...
pip install --only-binary :all: llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu121
if errorlevel 1 (
    echo.
    echo Wheel install failed. Try cu122: edit this .bat and change cu121 to cu122.
    pause
    exit /b 1
)
echo Installing other dependencies...
pip install -r requirements-other.txt
echo.
echo Done. Run: python main.py
pause
