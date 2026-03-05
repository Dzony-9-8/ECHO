@echo off
setlocal
title Project ECHO - Master Controller

echo ========================================================
echo   PROJECT ECHO - Master Startup Control (AI OS)
echo ========================================================

echo.
echo.
echo [1/4] Terminating existing ECHO processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    echo Killing backend process (PID: %%a)...
    taskkill /F /PID %%a 2>nul
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    echo Killing frontend process (PID: %%a)...
    taskkill /F /PID %%a 2>nul
)

echo.
echo [2/4] Validating Environments...

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

:: Create a temporary VBS script to run commands completely hidden
echo Set WshShell = CreateObject("WScript.Shell") > launch_hidden.vbs
echo WshShell.Run "cmd.exe /c " ^& WScript.Arguments(0), 0, False >> launch_hidden.vbs

echo.
echo [3/4] Launching AI Backend (Background)...
wscript.exe launch_hidden.vbs "cd ai-orchestrator && venv\Scripts\activate && python ..\api\server.py"

echo.
echo [4/4] Launching Web Interface (Background)...
wscript.exe launch_hidden.vbs "cd ai-ui && npm run dev"

:: Clean up the temporary VBS script
timeout /t 1 >nul
del launch_hidden.vbs

echo.
echo ========================================================
echo   ECHO CACHING IN BACKGROUND...
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
