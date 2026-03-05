@echo off
setlocal
title Project ECHO - Stealth Launcher

echo ========================================================
echo   PROJECT ECHO - Stealth Startup (Background)
echo ========================================================
echo.

:: Validation
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

echo [1/2] Launching Backend (Silent)...
wscript.exe silent_launch.vbs "cmd /c cd ai-orchestrator && venv\Scripts\python.exe ..\api\server.py"

echo [2/2] Launching UI (Silent)...
wscript.exe silent_launch.vbs "cmd /c cd ai-ui && npm run dev"

echo.
echo Launching browser in 5 seconds...
timeout /t 5 >nul
start http://localhost:5173

echo.
echo [DONE] Project ECHO is running in the background.
echo To stop the system, use Task Manager to kill Python and Node processes.
timeout /t 3 >nul
exit
