import { jsPDF } from "jspdf";
import { formatConversation, formatInsight } from "./formatter";

export function exportConversationPDF(filename, messages, insight = null) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    const marginX = 15;
    const marginY = 20;
    const lineHeight = 7;

    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();

    let text = formatConversation(messages);
    if (insight) {
        text += formatInsight(insight);
    }
    const lines = doc.splitTextToSize(
        text,
        pageWidth - marginX * 2
    );

    let y = marginY;

    for (const line of lines) {
        if (y + lineHeight > pageHeight - marginY) {
            doc.addPage();
            y = marginY;
        }
        doc.text(line, marginX, y);
        y += lineHeight;
    }

    doc.save(filename.endsWith(".pdf")
        ? filename
        : `${filename}.pdf`
    );
}
