@echo off
setlocal
echo ========================================================
echo   PROJECT ECHO - One-Click Setup (Production Ready)
echo ========================================================

echo.
echo [1/4] Setting up Python Backend...
cd ai-orchestrator
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install faster-whisper pyttsx3 fastapi uvicorn
cd ..

echo.
echo [2/4] Setting up React Frontend...
cd ai-ui
call npm.cmd install
cd ..

echo.
echo [3/4] Registering Windows Auto-Start Task...
powershell -ExecutionPolicy Bypass -File packaging\install_backend_task.ps1

echo.
echo [4/4] Creating Launchers...
echo @echo off > start_backend.bat
echo cd ai-orchestrator ^&^& venv\Scripts\python.exe ..\api\server.py >> start_backend.bat

echo @echo off > start_frontend.bat
echo cd ai-ui ^&^& npm.cmd run dev >> start_frontend.bat

echo.
echo ========================================================
echo   SETUP COMPLETE!
echo.
echo   To start the API:    run start_backend.bat
echo   To start the Chat:   run start_frontend.bat
echo ========================================================
pause
