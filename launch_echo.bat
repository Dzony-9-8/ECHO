@echo off
setlocal enabledelayedexpansion
:: Set the base project directory to where this .bat file lives
set "BASE_DIR=%~dp0"
:: Remove trailing backslash for consistency
if "%BASE_DIR:~-1%"=="\" set "BASE_DIR=%BASE_DIR:~0,-1%"

echo [STABILITY] Cleaning up existing ECHO processes...
taskkill /F /IM electron.exe /T >nul 2>&1
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1

:: Pause to let OS release ports
timeout /t 2 /nobreak >nul

echo [ECHO] Starting Backend...
cd /d "%BASE_DIR%"
start "ECHO Backend" /min cmd /c "uvicorn backend.main:app --host 127.0.0.1 --port 8000"

echo [ECHO] Starting Frontend...
cd /d "%BASE_DIR%\frontend"

:: We use 'npm run start' because it is the most reliable way to launch Vite + Electron in sync.
:: I have added the --no-sandbox and --disable-gpu flags directly into package.json.
npm run start

echo [ECHO] Shutting down...
pause
