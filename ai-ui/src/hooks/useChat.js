/**
 * ECHO V4 — useChat hook (frontend/src/hooks/useChat.js)
 * Encapsulates chat state and send logic, keeping Chat.jsx clean.
 */
import { useState, useRef } from "react";
import { sendChat } from "../services/api";

export function useChat() {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const isSending = useRef(false);

    const send = async ({ input, attachments = [], options = {} }) => {
        if (loading || isSending.current || (!input.trim() && !attachments.length)) return;

        isSending.current = true;
        setLoading(true);

        const imagesToSend = attachments.filter(a => a.type === "image").map(a => a.data);
        const textFiles = attachments.filter(a => a.type === "file");

        let finalMessage = input;
        if (textFiles.length > 0) {
            finalMessage += "\n\n[USER UPLOADED FILES]:\n";
            textFiles.forEach(f => {
                finalMessage += `--- START OF FILE: ${f.name} ---\n${f.data}\n--- END OF FILE ---\n`;
            });
        }

        const userMsg = { role: "user", content: finalMessage, images: imagesToSend };
        const history = [...messages, userMsg];
        setMessages([...history, { role: "assistant", content: "" }]);

        try {
            const data = await sendChat({
                messages: history.map(m => ({ role: m.role, content: m.content }))
                    .filter(m => m.role !== "assistant" || m.content !== ""),
                images: imagesToSend,
                ...options,
            });

            const { content } = data.choices[0].message;
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content };
                return updated;
            });

            return data; // Caller can check for weather_data etc.
        } catch (error) {
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1].content = `[ERROR]: ${error.message}`;
                return updated;
            });
        } finally {
            setLoading(false);
            isSending.current = false;
        }
    };

    const editMessage = (index, newContent) => {
        setMessages(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], content: newContent };
            return updated;
        });
    };

    return { messages, loading, send, editMessage, setMessages };
}
