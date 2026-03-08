import { useState } from "react";
import { X, Download, FileText, FileJson, File } from "lucide-react";
import { type ChatMessage } from "@/lib/api";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface Props {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
}

interface ExportOptions {
  includeTimestamps: boolean;
  includeAgentInfo: boolean;
  includeSystemMessages: boolean;
  title: string;
}

const ExportDialog = ({ open, onClose, messages }: Props) => {
  const [options, setOptions] = useState<ExportOptions>({
    includeTimestamps: true,
    includeAgentInfo: true,
    includeSystemMessages: false,
    title: `ECHO Chat — ${new Date().toISOString().slice(0, 10)}`,
  });

  if (!open) return null;

  const filtered = messages.filter((m) => {
    if (m.id === "welcome") return false;
    if (!options.includeSystemMessages && m.role === "system") return false;
    return true;
  });

  const exportMarkdown = () => {
    if (filtered.length === 0) { toast.info("No messages to export"); return; }
    let content = `# ${options.title}\n\n`;
    content += filtered.map((m) => {
      const role = m.role === "user" ? "**You**" : `**${m.agent || "Assistant"}**`;
      let line = `### ${role}`;
      if (options.includeAgentInfo && m.model) line += ` _(${m.model})_`;
      line += "\n";
      if (options.includeTimestamps) line += `_${m.timestamp.toLocaleString()}_\n`;
      line += `\n${m.content}`;
      return line;
    }).join("\n\n---\n\n");

    download(content, `echo-chat-${Date.now()}.md`, "text/markdown");
  };

  const exportJSON = () => {
    if (filtered.length === 0) { toast.info("No messages to export"); return; }
    const data = {
      title: options.title,
      exported_at: new Date().toISOString(),
      messages: filtered.map((m) => ({
        role: m.role,
        content: m.content,
        ...(options.includeAgentInfo && m.agent ? { agent: m.agent } : {}),
        ...(options.includeAgentInfo && m.model ? { model: m.model } : {}),
        ...(options.includeTimestamps ? { timestamp: m.timestamp.toISOString() } : {}),
      })),
    };
    download(JSON.stringify(data, null, 2), `echo-chat-${Date.now()}.json`, "application/json");
  };

  const exportPDF = () => {
    if (filtered.length === 0) { toast.info("No messages to export"); return; }
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;
    let y = 20;

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(options.title, margin, y);
    y += 10;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(128);
    doc.text(`Exported: ${new Date().toLocaleString()}`, margin, y);
    y += 8;
    doc.setTextColor(0);

    // Separator
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    for (const m of filtered) {
      // Check page overflow
      if (y > 270) { doc.addPage(); y = 20; }

      // Role header
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      const role = m.role === "user" ? "You" : (m.agent || "Assistant");
      let header = role;
      if (options.includeAgentInfo && m.model) header += ` → ${m.model}`;
      doc.text(header, margin, y);
      y += 4;

      if (options.includeTimestamps) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(128);
        doc.text(m.timestamp.toLocaleString(), margin, y);
        y += 4;
        doc.setTextColor(0);
      }

      // Content - simple text wrapping
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      // Strip markdown for PDF
      const plainContent = m.content
        .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, "").trim())
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/#{1,6}\s/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

      const lines = doc.splitTextToSize(plainContent, maxWidth);
      for (const line of lines) {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text(line, margin, y);
        y += 4;
      }

      y += 4;
      doc.setDrawColor(230);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    }

    doc.save(`echo-chat-${Date.now()}.pdf`);
    toast.success("Exported as PDF");
    onClose();
  };

  const download = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as ${filename.split(".").pop()?.toUpperCase()}`);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-background/80 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-mono text-primary uppercase tracking-wider flex items-center gap-2">
              <Download className="w-4 h-4" /> Export
            </h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Title */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Title</label>
              <input
                value={options.title}
                onChange={(e) => setOptions({ ...options, title: e.target.value })}
                className="w-full mt-1 bg-input border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Options</label>
              {([
                ["includeTimestamps", "Include timestamps"],
                ["includeAgentInfo", "Include agent/model info"],
                ["includeSystemMessages", "Include system messages"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options[key]}
                    onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
                    className="accent-primary w-3 h-3"
                  />
                  <span className="text-[10px] font-mono text-foreground">{label}</span>
                </label>
              ))}
            </div>

            <p className="text-[9px] font-mono text-muted-foreground">
              {filtered.length} message{filtered.length !== 1 ? "s" : ""} will be exported
            </p>

            {/* Format buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={exportMarkdown} className="flex flex-col items-center gap-1.5 p-3 rounded border border-border hover:border-primary hover:bg-primary/5 transition-colors group">
                <FileText className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                <span className="text-[10px] font-mono text-muted-foreground group-hover:text-primary">Markdown</span>
              </button>
              <button onClick={exportJSON} className="flex flex-col items-center gap-1.5 p-3 rounded border border-border hover:border-terminal-cyan hover:bg-terminal-cyan/5 transition-colors group">
                <FileJson className="w-5 h-5 text-muted-foreground group-hover:text-terminal-cyan" />
                <span className="text-[10px] font-mono text-muted-foreground group-hover:text-terminal-cyan">JSON</span>
              </button>
              <button onClick={exportPDF} className="flex flex-col items-center gap-1.5 p-3 rounded border border-border hover:border-terminal-amber hover:bg-terminal-amber/5 transition-colors group">
                <File className="w-5 h-5 text-muted-foreground group-hover:text-terminal-amber" />
                <span className="text-[10px] font-mono text-muted-foreground group-hover:text-terminal-amber">PDF</span>
              </button>
              <button onClick={() => {
                if (filtered.length === 0) { toast.info("No messages to export"); return; }
                const text = filtered.map(m => {
                  const role = m.role === "user" ? "You" : (m.agent || "Assistant");
                  return `[${role}]: ${m.content}`;
                }).join("\n\n");
                navigator.clipboard.writeText(text);
                toast.success("Copied to clipboard");
                onClose();
              }} className="flex flex-col items-center gap-1.5 p-3 rounded border border-border hover:border-accent hover:bg-accent/5 transition-colors group">
                <Copy className="w-5 h-5 text-muted-foreground group-hover:text-accent" />
                <span className="text-[10px] font-mono text-muted-foreground group-hover:text-accent">Clipboard</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ExportDialog;
