/**
 * ECHO V4 — Central API Service (frontend/src/services/api.js)
 * Replaces inline fetch() calls scattered across components.
 * All backend communication goes through this module.
 */

const BASE_URL = "http://127.0.0.1:8000";

/**
 * Send a chat message with all ECHO feature flags.
 * @param {object} opts
 * @returns {Promise<object>} OpenAI-compatible response
 */
export async function sendChat({
    messages,
    model = "llama3.1:8b",
    mode = "chat",
    webEnabled = false,
    ragEnabled = false,
    weatherEnabled = false,
    researchDepth = 0,
    images = [],
}) {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            stream: false,
            web_enabled: webEnabled,
            rag_enabled: ragEnabled,
            weather_enabled: weatherEnabled,
            research_depth: researchDepth,
            mode,
            images,
        }),
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || err.error || "API Error");
    }
    return response.json();
}

/**
 * Fetch session insights.
 * @param {string} sessionId
 */
export async function fetchInsight(sessionId = "current_session") {
    const response = await fetch(`${BASE_URL}/v1/insights/session/${sessionId}`);
    if (!response.ok) throw new Error("Insight fetch failed");
    return response.json();
}

/**
 * Fetch system health and resource profile.
 */
export async function fetchHealth() {
    const response = await fetch(`${BASE_URL}/health`);
    if (!response.ok) throw new Error("Health check failed");
    return response.json();
}

/**
 * Transcribe audio via the backend mock endpoint.
 * @param {FormData} formData
 */
export async function transcribeAudio(formData) {
    const response = await fetch(`${BASE_URL}/v1/audio/transcriptions`, {
        method: "POST",
        body: formData,
    });
    if (!response.ok) throw new Error("Transcription failed");
    return response.json();
}
