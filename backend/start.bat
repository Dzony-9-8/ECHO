@echo off
title ECHO Local Backend
cd /d "%~dp0"
echo.
echo  ECHO Local Backend
echo  ==================
echo.
echo  Starting on http://localhost:8000
echo  Press Ctrl+C to stop
echo.
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
