import { useState, useEffect } from "react";

export default function InsightPanel({ sessionId, onClose }) {
    const [insight, setInsight] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInsight = async () => {
            try {
                // Fetch latest insight for this session
                const url = sessionId
                    ? `http://127.0.0.1:8000/v1/insights/session/${sessionId}`
                    : `http://127.0.0.1:8000/v1/insights/latest`;

                const response = await fetch(url);
                const data = await response.json();

                if (data.status === "success") {
                    setInsight(data.insight);
                    if (onLoaded) onLoaded(data.insight);
                }
            } catch (err) {
                console.error("Failed to fetch insights:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchInsight();
    }, [sessionId]);

    if (loading) return (
        <div className="insight-panel loading">
            <p>Gathering V2 System Insights...</p>
        </div>
    );

    if (!insight) return (
        <div className="insight-panel empty">
            <p>No insights generated yet. Continue the conversation.</p>
            <button className="close-panel-btn" onClick={onClose}>Close</button>
        </div>
    );

    return (
        <div className="insight-panel">
            <div className="panel-header">
                <h2>ECHO V2 Session Insight</h2>
                <button className="close-panel-btn" onClick={onClose}>×</button>
            </div>

            <div className="panel-section">
                <h3>RAG Matches</h3>
                <p className="insight-text">{insight.rag_matches || "None retrieved"}</p>
            </div>

            <div className="panel-section">
                <h3>Web Sources</h3>
                <p className="insight-text">{insight.web_sources || "No external sources used"}</p>
            </div>

            <div className="panel-section">
                <h3>Research Info</h3>
                <p className="insight-text">Rounds: {insight.research_rounds || 0} | Branches: {insight.branch_count || 0}</p>
            </div>

            <div className="panel-section">
                <h3>Confidence Score</h3>
                <p className="insight-text confidence-value">{insight.confidence_score || "N/A"}</p>
            </div>

            <style>{`
                .insight-panel {
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    width: 320px;
                    max-height: 80vh;
                    background: #1e1e1e;
                    border: 1px solid #333;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    z-index: 1000;
                    overflow-y: auto;
                    color: #e0e0e0;
                    font-family: inherit;
                }
                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #333;
                    padding-bottom: 12px;
                    margin-bottom: 20px;
                }
                .panel-header h2 {
                    margin: 0;
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #fff;
                }
                .close-panel-btn {
                    background: none;
                    border: none;
                    color: #888;
                    font-size: 1.5rem;
                    cursor: pointer;
                    padding: 0 5px;
                }
                .close-panel-btn:hover {
                    color: #fff;
                }
                .panel-section {
                    margin-bottom: 20px;
                }
                .panel-section h3 {
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #888;
                    margin-bottom: 8px;
                }
                .insight-text {
                    font-size: 0.95rem;
                    line-height: 1.5;
                    margin: 0;
                    color: #ccc;
                }
                .patterns-list {
                    margin: 0;
                    padding-left: 20px;
                    list-style-type: disc;
                }
                .patterns-list li {
                    font-size: 0.9rem;
                    color: #ccc;
                    margin-bottom: 6px;
                }
                .confidence-value {
                    font-weight: 600;
                    text-transform: capitalize;
                }
                .loading, .empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    color: #888;
                }
            `}</style>
        </div>
    );
}
