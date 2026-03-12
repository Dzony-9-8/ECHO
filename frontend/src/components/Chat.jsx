import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import { exportConversationTxt } from "../utils/exportTxt";
import { exportConversationPDF } from "../utils/exportPdf";
import InsightPanel from "./InsightPanel";
import WeatherPanel from "./WeatherPanel";

export default function Chat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const stopListeningRef = useRef(null);
    const isSending = useRef(false);
    const [showInsight, setShowInsight] = useState(false);
    const [sessionId, setSessionId] = useState("current_session"); // Placeholder or get from backend
    const [isListening, setIsListening] = useState(false);
    const [userId, setUserId] = useState("user");
    const [latestInsight, setLatestInsight] = useState(null); // Track for export
    const mediaRecorderRef = useRef(null);

    // SEARCH & RESEARCH STATE
    const [webSearch, setWebSearch] = useState(false);
    const [deepResearchMode, setDeepResearchMode] = useState(false);
    const [searchProvider, setSearchProvider] = useState("duckduckgo"); // duckduckgo, google, searxng
    const [showSettings, setShowSettings] = useState(false); // For provider selection

    // ECHO V2 STATES
    const [ragEnabled, setRagEnabled] = useState(false);
    const [weatherEnabled, setWeatherEnabled] = useState(false);
    const [weatherData, setWeatherData] = useState(null);
    const [researchDepth, setResearchDepth] = useState(0);
    const [currentMode, setCurrentMode] = useState("chat");

    // DRAG & DROP STATE
    const [attachments, setAttachments] = useState([]); // { type: 'image'|'file', name: str, data: base64/text, preview: str }
    const [isDragging, setIsDragging] = useState(false);

    // --- AUDIO RECORDING (INLINE UTILITY) ---
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            let audioChunks = [];

            mediaRecorder.addEventListener("dataavailable", event => audioChunks.push(event.data));
            mediaRecorder.addEventListener("stop", async () => {
                const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
                setIsListening(false);

                // Send to Backend
                const formData = new FormData();
                formData.append("file", audioBlob, "voice_input.wav");

                try {
                    const response = await fetch("http://127.0.0.1:8000/v1/audio/transcriptions", { method: "POST", body: formData });
                    const data = await response.json();
                    if (data.text) setInput(prev => prev + (prev ? " " : "") + data.text);
                } catch (err) {
                    console.error("Backend Error:", err);
                    alert("Failed to reach transcription server.");
                }
                stream.getTracks().forEach(track => track.stop());
            });

            mediaRecorder.start();
            mediaRecorderRef.current = mediaRecorder;
            setIsListening(true);
        } catch (err) {
            console.error("Mic Error:", err);
            alert("Could not access microphone.");
            setIsListening(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isListening) mediaRecorderRef.current.stop();
    };

    const toggleVoiceInput = () => isListening ? stopRecording() : startRecording();

    // --- DRAG & DROP HANDLERS ---
    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        await processFiles(files);
    };

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files);
        await processFiles(files);
    };

    const processFiles = async (files) => {
        const newAttachments = [];
        for (const file of files) {
            if (file.type.startsWith("image/")) {
                const base64 = await readFileAsBase64(file);
                newAttachments.push({ type: 'image', name: file.name, data: base64, preview: base64 });
            } else {
                // Assume text/code
                try {
                    const text = await readFileAsText(file);
                    newAttachments.push({ type: 'file', name: file.name, data: text, preview: null });
                } catch (err) {
                    console.warn(`Skipping binary/unreadable file: ${file.name}`);
                }
            }
        }
        setAttachments(prev => [...prev, ...newAttachments]);
    };

    const readFileAsBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result); // Returns data:image/...;base64,...
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const readFileAsText = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    };

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // --- SEND LOGIC ---
    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(() => { scrollToBottom(); }, [messages]);

    const handleExport = (type) => {
        const now = new Date();
        const filename = `AI_${now.toISOString().split('T')[0]}`;

        // Simple confirmation for insight inclusion
        const includeInsight = latestInsight ? window.confirm("Include session insight in export?") : false;

        if (type === 'txt') exportConversationTxt(filename, messages, includeInsight ? latestInsight : null);
        else if (type === 'pdf') exportConversationPDF(filename, messages, includeInsight ? latestInsight : null);
    };

    const handleSend = async (overrideText = null) => {
        if (loading || isSending.current) return;
        const textInput = overrideText || input;

        // Construct final message with attachments
        let finalMessage = textInput;
        const imagesToSend = []; // List of pure Base64 strings (header stripped if needed by backend, generally llava takes base64)

        // Process attachments
        const textFiles = attachments.filter(a => a.type === 'file');
        const imageFiles = attachments.filter(a => a.type === 'image');

        // Inject text files content
        if (textFiles.length > 0) {
            finalMessage += "\n\n[USER UPLOADED FILES]:\n";
            textFiles.forEach(f => {
                finalMessage += `--- START OF FILE: ${f.name} ---\n${f.data}\n--- END OF FILE ---\n`;
            });
        }

        // Just strip the data:image... prefix if LLaVA expects pure b64, 
        // usually Ollama libs handle it, but standard is strip header.
        // Let's rely on standard data URI for now, backend logic might need adjustment if it crashes.
        imageFiles.forEach(img => {
            // Keep full data URI so frontend can display it easily, backend can parse it.
            imagesToSend.push(img.data);
        });

        if (!finalMessage.trim() && imagesToSend.length === 0) return;

        if (!window.electronAPI) {
            alert("Electron API missing! Run via launch_echo.bat");
            return;
        }

        const streamId = Date.now().toString();

        if (stopListeningRef.current) {
            stopListeningRef.current();
            stopListeningRef.current = null;
        }

        isSending.current = true;
        setLoading(true);

        // Update UI immediately
        const userMsgObj = { role: "user", content: finalMessage, images: imagesToSend };
        const currentHistory = [...messages, userMsgObj];
        setMessages([...currentHistory, { role: "assistant", content: "" }]);

        if (!overrideText) {
            setInput("");
            setAttachments([]); // Clear attachments
        }

        try {
            // DEEP RESEARCH PATH
            if (deepResearchMode) {
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1].content = "🔬 *Starting Deep Research Agent... This may take a moment.*";
                    return updated;
                });

                const result = await window.electronAPI.runDeepResearch({
                    query: finalMessage,
                    depth: 2,
                    breadth: 3,
                    provider: searchProvider
                });

                if (result.status === "success") {
                    const report = result.data.report;
                    const log = result.data.log.map(l => `[${l.step}] ${l.message}`).join("\n");
                    const fullOutput = `${report}\n\n<details><summary>Research Log</summary>\n\n\`\`\`text\n${log}\n\`\`\`\n</details>`;

                    setMessages(prev => {
                        const updated = [...prev];
                        updated[updated.length - 1].content = fullOutput;
                        return updated;
                    });
                } else {
                    throw new Error(result.message || "Deep Research Failed");
                }

                setLoading(false);
                isSending.current = false;
                return;
            }

            // STANDARD CHAT PATH
            const payload = {
                model: "llama3.1:8b",
                messages: currentHistory.map(m => ({
                    role: m.role,
                    content: m.content
                })).filter(m => m.role !== 'assistant' || m.content !== ""),
                temperature: 0.7,
                stream: false,
                web_enabled: webSearch,
                rag_enabled: ragEnabled,
                weather_enabled: weatherEnabled,
                research_depth: deepResearchMode ? 3 : researchDepth,
                mode: currentMode,
                images: imagesToSend
            };

            const response = await fetch("http://127.0.0.1:8000/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || errData.error || "API Error");
            }

            const data = await response.json();
            const assistantMessage = data.choices[0].message.content;

            if (data.weather_data) {
                setWeatherData(data.weather_data);
            }

            setMessages((prev) => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                updated[lastIdx] = { ...updated[lastIdx], content: assistantMessage };
                return updated;
            });

            setLoading(false);
            isSending.current = false;
        } catch (error) {
            console.error("Chat Error:", error);
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1].content = `[ERROR]: ${error.message}`;
                return updated;
            });
            setLoading(false);
            isSending.current = false;
        }
    };

    const handleEdit = (index, newContent) => {
        setMessages(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], content: newContent };
            return updated;
        });
    };

    return (
        <div
            className={`chat-container ${isDragging ? "drag-active" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* DRAG OVERLAY */}
            {isDragging && (
                <div className="drag-overlay">
                    <div className="drag-message">📂 Drop files here to analyze</div>
                </div>
            )}

            {/* INSIGHT TOGGLE */}
            <button
                className="insight-toggle-btn"
                onClick={() => setShowInsight(!showInsight)}
                title="View Session Insights"
            >
                🧠
            </button>

            {showInsight && (
                <InsightPanel
                    sessionId={sessionId}
                    onClose={() => setShowInsight(false)}
                    onLoaded={setLatestInsight}
                />
            )}

            {weatherData && (
                <WeatherPanel
                    location={weatherData.location}
                    current={weatherData.current}
                    forecast={weatherData.forecast}
                    onClose={() => setWeatherData(null)}
                />
            )}

            <div className="messages">
                {messages.length === 0 && (
                    <div className="welcome-message">
                        <h2>How can ECHO help you today?</h2>
                    </div>
                )}
                {messages.map((m, i) => (
                    <MessageBubble
                        key={i}
                        {...m}
                        onSave={(newVal) => handleEdit(i, newVal)}
                        onExportAction={handleExport}
                    />
                ))}
                {loading && <TypingIndicator />}
                <div ref={messagesEndRef} />
            </div>

            <div className="input-bar">
                {/* SETTINGS PANEL POPUP */}
                {showSettings && (
                    <div className="settings-popup">
                        <div className="settings-header">
                            <span>Search Settings</span>
                            <button className="close-btn" onClick={() => setShowSettings(false)}>×</button>
                        </div>
                        <div className="settings-content">
                            <label>Provider:</label>
                            <select value={searchProvider} onChange={(e) => setSearchProvider(e.target.value)}>
                                <option value="duckduckgo">DuckDuckGo (Default)</option>
                                <option value="google">Google (Scraper)</option>
                                <option value="searxng">SearXNG (Local)</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* ATTACHMENTS PREVIEW */}
                {attachments.length > 0 && (
                    <div className="attachments-preview">
                        {attachments.map((file, idx) => (
                            <div key={idx} className="attachment-chip">
                                {file.type === 'image' ? (
                                    <img src={file.preview} alt="preview" className="attachment-thumb" />
                                ) : (
                                    <span className="attachment-icon">📄</span>
                                )}
                                <span className="attachment-name">{file.name}</span>
                                <button className="attachment-remove" onClick={() => removeAttachment(idx)}>×</button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="input-container">
                    {/* WEB TOGGLES */}
                    <div className="web-controls">
                        <select
                            value={currentMode}
                            onChange={(e) => setCurrentMode(e.target.value)}
                            className="mode-select"
                            title="Assistant Mode"
                            style={{ background: '#333', color: 'white', border: 'none', padding: '4px', borderRadius: '4px', outline: 'none' }}
                        >
                            <option value="chat">Chat</option>
                            <option value="analysis">Analysis</option>
                            <option value="research">Research</option>
                            <option value="code">Code</option>
                            <option value="agent">Agent</option>
                        </select>

                        <button
                            className={`control-btn ${webSearch ? 'active' : ''}`}
                            onClick={() => { setWebSearch(!webSearch); }}
                            title="Toggle Web Search"
                        >
                            🌐
                        </button>

                        <button
                            className={`control-btn ${ragEnabled ? 'active-rag' : ''}`}
                            onClick={() => { setRagEnabled(!ragEnabled); }}
                            title="Toggle RAG Memory"
                        >
                            🧠
                        </button>

                        <button
                            className={`control-btn ${weatherEnabled ? 'active-weather' : ''}`}
                            onClick={() => { setWeatherEnabled(!weatherEnabled); }}
                            title="Toggle Local Weather Intelligence"
                            style={weatherEnabled ? { color: '#4fc3f7', borderColor: '#4fc3f7' } : {}}
                        >
                            ⛅
                        </button>

                        <div className="depth-slider" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px', fontSize: '0.8rem', color: '#ccc' }}>
                            <span title="Autonomous Research Depth">🧬 Depth: {researchDepth}</span>
                            <input
                                type="range"
                                min="0" max="5"
                                value={researchDepth}
                                onChange={(e) => setResearchDepth(parseInt(e.target.value))}
                                style={{ width: '60px' }}
                            />
                        </div>

                        <button
                            className="control-btn settings-btn"
                            onClick={() => setShowSettings(!showSettings)}
                            title="Search Provider Settings"
                        >
                            ⚙️
                        </button>
                    </div>

                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder={deepResearchMode ? "Enter research topic..." : "Message ECHO... (Drag files here)"}
                        autoFocus
                        disabled={loading}
                    />
                    <button
                        className={`mic-btn ${isListening ? 'listening' : ''}`}
                        onClick={toggleVoiceInput}
                        title="Voice Input"
                        style={{ marginRight: '8px', background: 'transparent', color: isListening ? '#ef4444' : '#888' }}
                    >
                        {isListening ? '🔴' : '🎤'}
                    </button>
                    <button onClick={() => handleSend()} disabled={loading || (!input.trim() && attachments.length === 0)}>
                        ↑
                    </button>
                </div>
            </div>

            <style>{`
                .drag-active {
                    border: 2px dashed #10b981;
                }
                .drag-overlay {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.7);
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;
                }
                .drag-message {
                    font-size: 2rem;
                    color: white;
                    font-weight: bold;
                }
                .attachments-preview {
                    display: flex;
                    gap: 8px;
                    padding: 8px;
                    background: #2a2a2a;
                    border-radius: 8px 8px 0 0;
                    overflow-x: auto;
                }
                .attachment-chip {
                    display: flex;
                    align-items: center;
                    background: #333;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    gap: 6px;
                }
                .attachment-thumb {
                    width: 20px;
                    height: 20px;
                    object-fit: cover;
                    border-radius: 2px;
                }
                .attachment-remove {
                    background: none;
                    border: none;
                    color: #ef4444;
                    cursor: pointer;
                    font-weight: bold;
                    padding: 0 4px;
                }
                .attachment-remove:hover {
                    color: #ff6b6b;
                }
                
                /* WEB CONTROLS */
                .web-controls {
                    display: flex;
                    gap: 4px;
                    margin-right: 8px;
                    align-items: center;
                }
                .control-btn {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    font-size: 1.2rem;
                    padding: 4px;
                    border-radius: 4px;
                    opacity: 0.6;
                    transition: all 0.2s;
                }
                .control-btn:hover {
                    opacity: 1;
                    background: #333;
                }
                .control-btn.active {
                    opacity: 1;
                    background: #3b82f6; /* Blue for Web */
                    box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
                }
                .control-btn.active-deep {
                    opacity: 1;
                    background: #8b5cf6; /* Purple for Deep Research */
                    box-shadow: 0 0 8px rgba(139, 92, 246, 0.5);
                }
                
                /* SETTINGS POPUP */
                .settings-popup {
                    position: absolute;
                    bottom: 80px;
                    left: 20px;
                    background: #1e1e1e;
                    border: 1px solid #444;
                    border-radius: 8px;
                    padding: 12px;
                    z-index: 2000;
                    width: 200px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                }
                .settings-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                    border-bottom: 1px solid #333;
                    padding-bottom: 4px;
                }
                .close-btn {
                    background: none;
                    border: none;
                    color: #888;
                    cursor: pointer;
                }
                .settings-content select {
                    width: 100%;
                    padding: 4px;
                    background: #333;
                    color: white;
                    border: 1px solid #555;
                    border-radius: 4px;
                }
            `}</style>
        </div>
    );
}
