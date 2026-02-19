import { formatConversation, formatInsight } from "./formatter";

export function exportConversationTxt(filename, messages, insight = null) {
    let text = formatConversation(messages);
    if (insight) {
        text += formatInsight(insight);
    }

    const blob = new Blob([text], {
        type: "text/plain;charset=utf-8"
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename.endsWith(".txt")
        ? filename
        : `${filename}.txt`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}
