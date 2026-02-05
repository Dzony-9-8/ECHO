import { useState, useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import { exportConversationTxt } from "../utils/exportTxt";
import { exportConversationPDF } from "../utils/exportPdf";

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
    const mediaRecorderRef = useRef(null);

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
                    const response = await fetch("http://127.0.0.1:8002/transcribe", { method: "POST", body: formData });
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
        if (type === 'txt') exportConversationTxt(filename, messages);
        else if (type === 'pdf') exportConversationPDF(filename, messages);
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
        const userMsgObj = { role: "user", content: finalMessage, images: imagesToSend }; // Add images for local display support if we want
        const currentHistory = [...messages, userMsgObj];
        setMessages([...currentHistory, { role: "assistant", content: "" }]);

        if (!overrideText) {
            setInput("");
            setAttachments([]); // Clear attachments
        }

        try {
            // Send to Electron -> Backend
            const result = await window.electronAPI.sendMessage({
                messages: currentHistory,
                streamId: streamId,
                images: imagesToSend.length > 0 ? imagesToSend : null,
                sessionId: sessionId
            });

            if (result && result.success) {
                stopListeningRef.current = window.electronAPI.listenToStream(streamId, (packet) => {
                    if (packet.type === 'token') {
                        setMessages((prev) => {
                            if (prev.length === 0) return prev;
                            const updated = [...prev];
                            const lastIdx = updated.length - 1;
                            updated[lastIdx] = { ...updated[lastIdx], content: updated[lastIdx].content + String(packet.data) };
                            return updated;
                        });
                    } else if (packet.type === 'end') {
                        setLoading(false);
                        isSending.current = false;
                        if (stopListeningRef.current) { stopListeningRef.current(); stopListeningRef.current = null; }
                    } else if (packet.type === 'error') {
                        throw new Error(packet.data);
                    }
                });
            } else {
                throw new Error(result?.error || "Failed to connect.");
            }
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
                <div style={{ position: 'fixed', right: 20, top: 80, zIndex: 100, background: '#1e1e1e', padding: 20, borderRadius: 8, border: '1px solid #333' }}>
                    <h3>Session Insights</h3>
                    <p>Coming soon...</p>
                    <button onClick={() => setShowInsight(false)}>Close</button>
                </div>
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
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder="Message ECHO... (Drag files here)"
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
            `}</style>
        </div>
    );
}
