import { useState, useEffect } from 'react';

export default function InsightPanel({ sessionId, onClose, onRefresh }) {
    const [insight, setInsight] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInsight();
    }, [sessionId]);

    const fetchInsight = async () => {
        try {
            setLoading(true);
            const response = await fetch(`http://127.0.0.1:8002/insight/get?session_id=${sessionId || ''}`);
            const data = await response.json();
            if (data.status === 'success') {
                setInsight(data.insight);
            }
        } catch (error) {
            console.error("Failed to fetch insight:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        try {
            setLoading(true);
            const response = await fetch("http://127.0.0.1:8002/insight/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: "", session_id: sessionId })
            });
            const data = await response.json();
            if (data.status === 'success') {
                setInsight(data.insight);
                if (onRefresh) onRefresh();
            }
        } catch (error) {
            console.error("Failed to generate insight:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !insight) return <div className="insight-panel loading">Analyzing session intelligence...</div>;

    return (
        <div className="insight-panel slide-in">
            <div className="insight-header">
                <h3>🧠 Core Intelligence</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>

            {insight ? (
                <div className="insight-content">
                    <div className="insight-section">
                        <label>Emotional Trajectory</label>
                        <p>{insight.emotional_summary}</p>
                    </div>

                    <div className="insight-section">
                        <label>Detected Intent</label>
                        <p>{insight.intent_summary}</p>
                    </div>

                    <div className="insight-section">
                        <label>Notable Patterns</label>
                        <ul className="pattern-list">
                            {insight.notable_patterns && insight.notable_patterns.map((p, i) => (
                                <li key={i}>{p}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="insight-footer">
                        <span className={`confidence-badge ${insight.confidence_level?.toLowerCase()}`}>
                            Confidence: {insight.confidence_level}
                        </span>
                        <button className="refresh-btn" onClick={handleGenerate} title="Re-analyze session">
                            🔄 Update Analysis
                        </button>
                    </div>
                </div>
            ) : (
                <div className="empty-insight">
                    <p>No insight generated for this session yet.</p>
                    <button className="generate-btn" onClick={handleGenerate}>
                        Generate Session Insight
                    </button>
                </div>
            )}
        </div>
    );
}
