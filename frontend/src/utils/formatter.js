export function formatConversation(messages) {
    return messages.map(m => {
        const role =
            m.role === "assistant" ? "AI" :
                m.role === "user" ? "USER" :
                    "SYSTEM";

        return `[${m.timestamp ?? ""}] ${role}:\n${m.content}\n`;
    }).join("\n----------------------------------------\n\n");
}
