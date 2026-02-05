@echo off
echo Starting ECHO AI Frontend...
cd /d "%~dp0frontend"
echo.
echo Killing any existing Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo.
echo Starting Vite dev server...
start "ECHO Frontend" cmd /k "npm run dev"
echo.
echo Frontend should be starting at http://localhost:5173
echo Press any key to exit this window...
pause >nul
