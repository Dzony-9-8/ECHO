#!/bin/bash
# scripts/start_dev.sh — Start ECHO in development mode
set -e

echo "Starting ECHO V4 Backend (dev mode)..."

export ECHO_MODE=desktop
export ACTIVE_PROVIDER=ollama

cd "$(dirname "$0")/.."
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
