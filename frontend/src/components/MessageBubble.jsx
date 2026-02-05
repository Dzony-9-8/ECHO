import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import html2pdf from 'html2pdf.js';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

export default function MessageBubble({ role, content, onSave, onExportAction }) {
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

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(cleanContent);
            console.log('Message copied!');
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className={`message-wrapper ${role}`}>
            <div className={`bubble ${role}`}>
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

                        {/* DYNAMIC EXPORT BUTTON */}
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
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
