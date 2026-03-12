"""
ECHO V4 — Tool Tests (backend/tests/test_tools.py)
"""
import pytest
from backend.app.tools.weather import WeatherTool
from backend.app.tools.web import WebTool
from backend.app.tools.rag import RAGTool


def test_weather_tool_returns_structure(monkeypatch):
    from backend.app.core import weather_engine as we_mod

    monkeypatch.setattr(we_mod.weather_engine, "get_weather", lambda loc: {
        "location": loc, "current": {"temperature": 20, "windspeed": 10, "weathercode": 1},
        "forecast": []
    })
    tool = WeatherTool()
    result = tool.execute({"location": "Belgrade"})
    assert result["error"] is None
    assert result["result"]["location"] == "Belgrade"


def test_web_tool_disabled():
    tool = WebTool()
    result = tool.execute({"query": "test query"})
    # Should succeed (either results or graceful disabled msg)
    assert "result" in result
    assert "error" in result


def test_rag_tool_disabled_gracefully():
    tool = RAGTool()
    result = tool.execute({"query": "test"})
    assert "result" in result  # Returns [] or error message, never crashes
