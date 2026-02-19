export function formatConversation(messages) {
    return messages.map(m => {
        const role =
            m.role === "assistant" ? "AI" :
                m.role === "user" ? "USER" :
                    "SYSTEM";

        return `[${m.timestamp ?? ""}] ${role}:\n${m.content}\n`;
    }).join("\n----------------------------------------\n\n");
}
export function formatInsight(insight) {
    if (!insight) return "";

    const patterns = insight.notable_patterns
        ? insight.notable_patterns.map(p => `• ${p}`).join("\n")
        : "No patterns identified.";

    return `\n
----------------------------------------
SESSION INSIGHT
----------------------------------------
Emotional tone:
${insight.emotional_summary}

Primary intent:
${insight.intent_summary}

Notable patterns:
${patterns}

Confidence:
${insight.confidence_level}\n`;
}
