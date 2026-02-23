"""
ECHO V4 — Chat Endpoint Tests (backend/tests/test_chat.py)
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "resource_profile" in data


def test_chat_basic(monkeypatch):
    """Mock the orchestrator to avoid needing a live Ollama instance."""
    from backend.app.core import orchestrator as orch_module

    def mock_process(request_data):
        return {
            "id": "chatcmpl-test",
            "object": "chat.completion",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": "Hello!"}, "finish_reason": "stop"}]
        }

    monkeypatch.setattr(orch_module.orchestrator, "process_request", mock_process)

    response = client.post("/v1/chat/completions", json={
        "model": "llama3.1:8b",
        "messages": [{"role": "user", "content": "Hello"}]
    })
    assert response.status_code == 200
    data = response.json()
    assert data["choices"][0]["message"]["content"] == "Hello!"


def test_chat_stream_returns_501():
    response = client.post("/v1/chat/completions", json={
        "model": "llama3.1:8b",
        "messages": [{"role": "user", "content": "Hi"}],
        "stream": True
    })
    assert response.status_code == 501
