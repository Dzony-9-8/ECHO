import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import { sendChatStream } from "../services/api";
import { exportConversationTxt } from "../utils/exportTxt";
import { exportConversationPDF } from "../utils/exportPdf";
import InsightPanel from "./InsightPanel";
import WeatherPanel from "./WeatherPanel";
import TypingIndicator from "./TypingIndicator";

export default function Chat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const stopListeningRef = useRef(null);
    const isSending = useRef(false);
    const [showInsight, setShowInsight] = useState(false);
    const [sessionId, _setSessionId] = useState("current_session"); // Placeholder or get from backend
    const [isListening, setIsListening] = useState(false);
    const [_userId, _setUserId] = useState("user");
    const [latestInsight, setLatestInsight] = useState(null); // Track for export
    const mediaRecorderRef = useRef(null);

    // SEARCH & RESEARCH STATE
    const [webSearch, setWebSearch] = useState(false);
    const [deepResearchMode, _setDeepResearchMode] = useState(false);
    const [searchProvider, setSearchProvider] = useState("duckduckgo"); // duckduckgo, google, searxng
    const [showSettings, setShowSettings] = useState(false); // For provider selection

    // ECHO V2 STATES
    const [ragEnabled, setRagEnabled] = useState(false);
    const [weatherEnabled, setWeatherEnabled] = useState(false);
    const [weatherData, setWeatherData] = useState(null);
    const [researchDepth, setResearchDepth] = useState(0);
    const [currentMode, setCurrentMode] = useState("chat");
    const [hiddenAgents, setHiddenAgents] = useState(new Set());

    // --- AGENT TOGGLE HANDLER ---
    const toggleAgentVisibility = (agentName) => {
        setHiddenAgents(prev => {
            const next = new Set(prev);
            if (next.has(agentName)) next.delete(agentName);
            else next.add(agentName);
            return next;
        });
    };

    const agents = [
        { id: 'supervisor', name: 'Supervisor', color: '#f59e0b', icon: '👑' },
        { id: 'dev_agent', name: 'Developer', color: '#10b981', icon: '💻' },
        { id: 'research_agent', name: 'Researcher', color: '#3b82f6', icon: '🔍' },
        { id: 'critic_agent', name: 'Critic', color: '#8b5cf6', icon: '⚖️' }
    ];

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

    const _handleFileSelect = async (e) => {
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
                } catch {
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

        // streamId reserved for future streaming implementation
        // const streamId = Date.now().toString();

        if (stopListeningRef.current) {
            stopListeningRef.current();
            stopListeningRef.current = null;
        }

        isSending.current = true;
        setLoading(true);

        // Update UI immediately
        const userMsgObj = {
            id: `user-${Date.now()}`,
            role: "user",
            content: finalMessage,
            images: imagesToSend
        };
        const currentHistory = [...messages, userMsgObj];
        setMessages(currentHistory); // Don't add a blank assistant entry — the stream placeholder handles this

        if (!overrideText) {
            setInput("");
            setAttachments([]); // Clear attachments
        }

        // A unique ID for the current stream's status bubble (declared here so catch can access it)
        let placeholderId = null;

        try {
            // DEEP RESEARCH PATH — only available in Electron mode
            if (deepResearchMode && window.electronAPI) {
                const drPlaceholderId = `dr-${Date.now()}`;
                setMessages(prev => [...prev, {
                    id: drPlaceholderId,
                    role: "assistant",
                    agent: "system",
                    content: "🔬 *Starting Deep Research Agent... This may take a moment.*",
                    isStatus: true
                }]);

                const result = await window.electronAPI.runDeepResearch({
                    query: finalMessage,
                    depth: 2,
                    breadth: 3,
                    provider: searchProvider
                });

                if (result.status === "success") {
                    const { report, log } = result.data;
                    const logStr = log.map(l => `[${l.step}] ${l.message}`).join("\n");
                    const fullOutput = `${report}\n\n<details><summary>Research Log</summary>\n\n\`\`\`text\n${logStr}\n\`\`\`\n</details>`;

                    setMessages(prev => prev.map(m => m.id === drPlaceholderId
                        ? { ...m, content: fullOutput, isStatus: false }
                        : m
                    ));
                } else {
                    throw new Error(result.message || "Deep Research Failed");
                }

                setLoading(false);
                isSending.current = false;
                return;
            }

            // Build dynamic tags based on legacy frontend switches
            const tags = [];
            if (webSearch) tags.push("web_search");
            if (ragEnabled) tags.push("rag");
            if (weatherEnabled) tags.push("weather");
            if (deepResearchMode) tags.push("deep_research");

            // Set placeholder and show it
            placeholderId = `status-${Date.now()}`;
            setMessages(prev => [...prev, {
                id: placeholderId,
                role: "assistant",
                agent: "system",
                content: "*Contacting swarm...*",
                isStatus: true
            }]);

            await sendChatStream({
                message: finalMessage,
                task_type: currentMode,
                tags: tags,
                onChunk: (chunk) => {
                    setMessages((prev) => {
                        const updated = [...prev];
                        const sIdx = updated.findIndex(m => m.id === placeholderId);

                        if (sIdx === -1) return prev; // Safety

                        if (chunk.type === "status") {
                            updated[sIdx] = {
                                ...updated[sIdx],
                                agent: chunk.agent || "system",
                                content: `*${chunk.content}*`
                            };
                        } else if (chunk.type === "payload" || chunk.type === "tool_output") {
                            const data = chunk.data || {};
                            // Insert payload BEFORE the status placeholder
                            updated.splice(sIdx, 0, {
                                id: `payload-${Date.now()}-${Math.random()}`,
                                role: "assistant",
                                agent: chunk.agent || "system",
                                content: data.output || JSON.stringify(data),
                                confidence: data.confidence,
                                citations: data.citations,
                                requiresRevision: data.requires_revision
                            });
                        } else if (chunk.type === "error") {
                            updated[sIdx] = {
                                ...updated[sIdx],
                                content: `[ERROR]: ${chunk.content}`,
                                isStatus: false
                            };
                        }
                        return updated;
                    });
                }
            });

            // Cleanup placeholder if it's still a status (remove "Gathering results..." but keep errors)
            setMessages(prev => prev.filter(m => m.id !== placeholderId || !m.isStatus));

            setLoading(false);
            isSending.current = false;
        } catch (error) {
            console.error("Chat Error:", error);
            const isOffline = error.message === "Failed to fetch";
            const errMsg = isOffline
                ? "⚠️ **Cannot reach the ECHO backend.** Make sure the server is running (`ECHO.bat` or `uvicorn api.server:app`)."
                : `**Error:** ${error.message}`;
            // Update placeholder to show the error, or append a new error bubble
            setMessages(prev => {
                const withErr = prev.map(m =>
                    m.id === placeholderId ? { ...m, content: errMsg, isStatus: false } : m
                );
                // If placeholder wasn't found, append a new error bubble
                if (!withErr.some(m => m.id === placeholderId)) {
                    return [...withErr, { id: `err-${Date.now()}`, role: "assistant", agent: "system", content: errMsg }];
                }
                return withErr;
            });
            setLoading(false);
            isSending.current = false;
        }
    };

    const handleEdit = (msgId, newContent) => {
        setMessages(prev => {
            return prev.map(m => m.id === msgId ? { ...m, content: newContent } : m);
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



            {/* FILTER SWARM BAR */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 20px',
                background: '#111', borderBottom: '1px solid #2a2a2a',
                flexWrap: 'wrap', boxSizing: 'border-box', width: '100%', flexShrink: 0
            }}>
                <span style={{ fontSize: '0.65rem', color: '#555', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>Filter Swarm:</span>
                {agents.map(agent => {
                    const isHidden = hiddenAgents.has(agent.id);
                    return (
                        <button
                            key={agent.id}
                            className="agent-tag"
                            onClick={() => toggleAgentVisibility(agent.id)}
                            title={`Toggle ${agent.name} visibility`}
                            style={{
                                borderColor: isHidden ? '#333' : agent.color,
                                background: isHidden ? 'transparent' : `${agent.color}20`,
                                color: isHidden ? '#444' : agent.color,
                            }}
                        >
                            <span>{agent.icon}</span>
                            {agent.name}
                        </button>
                    );
                })}
            </div>

            <div className="messages">
                {messages.length === 0 && (
                    <div className="welcome-message">
                        <h2>How can ECHO help you today?</h2>
                    </div>
                )}
                {messages.filter(m => !m.agent || !hiddenAgents.has(m.agent)).map((msg) => (
                    <MessageBubble
                        key={msg.id}
                        {...msg}
                        onSave={(newVal) => handleEdit(msg.id, newVal)}
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

                        {/* INSIGHT BUTTON — moved from floating position into toolbar */}
                        <button
                            className={`control-btn ${showInsight ? 'active-rag' : ''}`}
                            onClick={() => setShowInsight(!showInsight)}
                            title="View Session Insights"
                        >
                            💡
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

            {/* INSIGHT PANEL (portal-like, opens above input) */}
            {showInsight && (
                <InsightPanel
                    sessionId={sessionId}
                    onClose={() => setShowInsight(false)}
                    onLoaded={setLatestInsight}
                />
            )}

            {/* WEATHER PANEL */}
            {weatherData && (
                <WeatherPanel
                    location={weatherData.location}
                    current={weatherData.current}
                    forecast={weatherData.forecast}
                    onClose={() => setWeatherData(null)}
                />
            )}

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
                    gap: 8px;
                    margin-right: 12px;
                    alignItems: center;
                }
                .control-btn {
                    background: transparent;
                    border: 1px solid rgba(255,255,255,0.1);
                    cursor: pointer;
                    font-size: 1.1rem;
                    padding: 5px 8px;
                    border-radius: 6px;
                    opacity: 0.7;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
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

                /* AGENT TOGGLES */
                .agent-toggle-btn.hidden {
                    opacity: 0.5;
                    filter: grayscale(1);
                }
                .agent-toggle-btn.active:hover {
                    background: rgba(255,255,255,0.05);
                    transform: translateY(-1px);
                }
                .agent-toggle-btn.hidden:hover {
                    opacity: 0.8;
                    filter: grayscale(0.5);
                }
            `}</style>
        </div>
    );
}
