@echo off
setlocal
title Project ECHO - Master Controller

echo ========================================================
echo   PROJECT ECHO - Master Startup Control (AI OS)
echo ========================================================

echo.
echo [1/3] Validating Environments...

if not exist ai-orchestrator\venv (
    echo [!] Missing ai-orchestrator environment.
    echo Please run setup_all.bat first.
    pause
    exit /b
)

if not exist ai-ui\node_modules (
    echo [!] Missing ai-ui dependencies.
    echo Please run setup_all.bat first.
    pause
    exit /b
)

echo.
echo [2/3] Launching AI Backend (api/server.py)...
start "ECHO Backend" cmd /k "cd ai-orchestrator && venv\Scripts\activate && python ..\api\server.py"

echo.
echo [3/3] Launching Web Interface (vite)...
start "ECHO UI" cmd /k "cd ai-ui && npm run dev"

echo.
echo ========================================================
echo   ECHO IS INITIALIZING...
echo.
echo   - Backend will be available at http://localhost:8000
echo   - Frontend will be available at http://localhost:5173
echo.
echo   Waiting for servers to start before opening browser...
echo ========================================================

timeout /t 5 >nul
start http://localhost:5173

echo.
echo [DONE] System hand-off complete.
timeout /t 3 >nul
exit
