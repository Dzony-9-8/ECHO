@echo off
setlocal
title ECHO Multi-Agent Platform Launcher

echo ============================================================
echo   PROJECT ECHO - Multi-Agent AI Platform
echo   React + Tailwind UI  /  FastAPI AgentManager Backend
echo ============================================================
echo.

:: Kill any stale processes on relevant ports
echo [1/4] Cleaning up existing processes...
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 1 /nobreak >nul

echo.
echo [2/4] Starting FastAPI Backend (AgentManager)...
start "ECHO Backend" /min cmd /c "cd /d "D:\AI\Claude Code\Project ECHO\ai-orchestrator" && venv\Scripts\activate && python ..\api\server.py"

:: Give the backend a moment to initialize
timeout /t 3 /nobreak >nul

echo.
echo [3/4] Starting ECHO Frontend (Dark UI)...
start "ECHO Frontend" /min cmd /c "cd /d "D:\AI\Claude Code\Project ECHO\ai-ui" && powershell -ExecutionPolicy Bypass -Command "npm run start""

echo.
echo [4/4] Waiting for servers to initialize...
timeout /t 5 /nobreak >nul

echo.
echo ============================================================
echo   Backend  -> http://localhost:8000
echo   Frontend -> http://localhost:5173
echo ============================================================
echo.
echo Opening browser...
start http://localhost:5173

echo.
echo [DONE] Both servers are running in the background.
echo        Close this window to keep them running,
echo        or use Task Manager to stop them.
echo.
pause
