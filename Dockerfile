FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY backend/ ./backend/

# Expose port
EXPOSE 8000

# Run the V4 app
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
