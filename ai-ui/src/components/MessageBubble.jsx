import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

export default function MessageBubble({ role, content, onSave, onExportAction, agent, confidence, citations, requiresRevision }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(content);
    const contentRef = useRef(null);

    // PARSE EXPORT TAGS
    // Looks for [[EXPORT_ACTION: TYPE]] at the end of the message
    const exportMatch = content.match(/\[\[EXPORT_ACTION:\s*(PDF|TXT)\]\]$/);
    const exportType = exportMatch ? exportMatch[1] : null;
    const cleanContent = content.replace(/\[\[EXPORT_ACTION:\s*(PDF|TXT)\]\]$/, '').trim();

    const handleSave = () => {
        onSave(editValue);
        setIsEditing(false);
    };

    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            // Priority: Electron API (Bypasses browser permission issues)
            if (window.electronAPI && window.electronAPI.copyToClipboard) {
                const result = await window.electronAPI.copyToClipboard(cleanContent);
                if (result.success) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                    return;
                }
            }

            // Fallback: Standard Browser API
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(cleanContent);
            } else {
                // Fallback 2: Old execCommand
                const textArea = document.createElement("textarea");
                textArea.value = cleanContent;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Helper to format agent names beautifully
    const formatAgentName = (agentStr) => {
        if (!agentStr) return "";
        return agentStr.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    // Color map for different agents
    const getAgentColor = (agentStr) => {
        switch (agentStr) {
            case 'research_agent': return '#3b82f6'; // Blue
            case 'critic_agent': return '#8b5cf6'; // Purple
            case 'dev_agent': return '#10b981'; // Green
            case 'supervisor': return '#f59e0b'; // Amber
            default: return '#ababab';
        }
    };

    return (
        <div className={`message-wrapper ${role}`}>
            {/* AGENT IDENTITY HEADER */}
            {role === 'assistant' && agent && (
                <div className="agent-header" style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    marginBottom: '4px', fontSize: '0.85rem', color: getAgentColor(agent),
                    fontWeight: 'bold', marginLeft: '12px'
                }}>
                    <span className="agent-badge">🤖 {formatAgentName(agent)}</span>
                    {confidence !== undefined && confidence !== null && (
                        <div className="confidence-meter" title={`Confidence: ${(confidence * 100).toFixed(0)}%`} style={{
                            display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8
                        }}>
                            <div style={{ width: '40px', height: '4px', background: '#333', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{
                                    width: `${Math.max(0, Math.min(100, confidence * 100))}%`,
                                    height: '100%',
                                    background: confidence > 0.8 ? '#10b981' : confidence > 0.5 ? '#f59e0b' : '#ef4444'
                                }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#888' }}>{(confidence * 100).toFixed(0)}%</span>
                        </div>
                    )}
                </div>
            )}

            <div className={`bubble ${role}`} style={role === 'assistant' ? { borderTopLeftRadius: 0 } : {}}>
                {isEditing ? (
                    <div className="edit-mode">
                        <textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                        />
                        <div className="edit-actions">
                            <button onClick={handleSave}>Save & Submit</button>
                            <button onClick={() => setIsEditing(false)}>Cancel</button>
                        </div>
                    </div>
                ) : (
                    <div className="markdown-content" ref={contentRef}>
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                                code({ className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    if (match) {
                                        return (
                                            <div className="code-block-container">
                                                <div className="code-header">
                                                    <span>{match[1]}</span>
                                                </div>
                                                <SyntaxHighlighter
                                                    style={vscDarkPlus}
                                                    language={match[1]}
                                                    PreTag="div"
                                                    {...props}
                                                >
                                                    {String(children).replace(/\n$/, '')}
                                                </SyntaxHighlighter>
                                            </div>
                                        );
                                    }
                                    return <code>{children}</code>;
                                },
                                a({ children, ...props }) {
                                    return <a target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                                }
                            }}
                        >
                            {cleanContent}
                        </ReactMarkdown>

                        {/* CITATIONS BLOCK */}
                        {citations && citations.length > 0 && (
                            <div className="citations-container" style={{
                                marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)',
                                borderRadius: '6px', fontSize: '0.85rem', borderLeft: `3px solid ${getAgentColor(agent)}`
                            }}>
                                <h4 style={{ margin: '0 0 8px 0', color: '#888', fontSize: '0.8rem', textTransform: 'uppercase' }}>Sources & Citations</h4>
                                <ul style={{ margin: 0, paddingLeft: '20px', color: '#ccc' }}>
                                    {citations.map((cite, idx) => (
                                        <li key={idx} style={{ marginBottom: '4px' }}>
                                            {cite.url ? (
                                                <a href={cite.url} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: 'none' }}>
                                                    {cite.title || cite.url}
                                                </a>
                                            ) : (
                                                <span>{cite.title || cite.contentSnippet || "Verified Source"}</span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* EXPORT BUTTON */}
                        {exportType && (
                            <div className="dynamic-export-container" style={{ marginTop: '12px' }}>
                                <button
                                    className="dynamic-export-btn"
                                    onClick={() => onExportAction && onExportAction(exportType.toLowerCase())}
                                >
                                    <span style={{ marginRight: '8px', fontSize: '16px' }}>👉</span>
                                    <span style={{ fontWeight: 500 }}>Download the {exportType}</span>
                                </button>
                            </div>
                        )}

                        {/* REVISION PROMPT */}
                        {requiresRevision && (
                            <div className="revision-prompt" style={{
                                marginTop: '12px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px',
                                color: '#fca5a5', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                                <span>⚠️</span>
                                <span>Critic flagged this output for potential revision due to low confidence.</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {!isEditing && (
                <div className="message-actions">
                    <button
                        className="action-btn"
                        onClick={handleCopy}
                        title="Copy message"
                    >
                        {copied ? (
                            <span style={{ fontSize: '10px', color: '#4ade80', fontWeight: 'bold' }}>Copied!</span>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        )}
                    </button>
                    {role === 'user' && (
                        <button
                            className="action-btn"
                            onClick={() => setIsEditing(true)}
                            title="Edit message"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
