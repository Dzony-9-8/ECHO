// Documents — a small writing-first document store persisted locally.

export interface Doc {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

const KEY = "echo_documents";

export const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const loadDocs = (): Doc[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
};
export const saveDocs = (docs: Doc[]) => localStorage.setItem(KEY, JSON.stringify(docs));

export const upsertDoc = (doc: Doc): Doc[] => {
  const docs = loadDocs();
  const idx = docs.findIndex((d) => d.id === doc.id);
  if (idx >= 0) docs[idx] = doc;
  else docs.unshift(doc);
  saveDocs(docs);
  return docs;
};
export const deleteDoc = (id: string): Doc[] => {
  const docs = loadDocs().filter((d) => d.id !== id);
  saveDocs(docs);
  return docs;
};

export const sortDocs = (docs: Doc[]): Doc[] =>
  [...docs].sort((a, b) => b.updatedAt - a.updatedAt);

export const wordCount = (text: string): number =>
  (text.trim().match(/\S+/g) || []).length;

// ── Export ────────────────────────────────────────────────────────────────────
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const exportDoc = (doc: Doc, format: "md" | "txt" | "html") => {
  const safeName = (doc.title.trim() || "document").replace(/[^\w-]+/g, "-").slice(0, 60);
  let content = doc.content;
  let mime = "text/plain";
  let ext = format;

  if (format === "md") {
    content = `# ${doc.title || "Untitled"}\n\n${doc.content}`;
    mime = "text/markdown";
  } else if (format === "html") {
    content =
      `<!doctype html><meta charset="utf-8"><title>${escapeHtml(doc.title || "Untitled")}</title>` +
      `<body style="max-width:720px;margin:40px auto;font:16px/1.6 system-ui;padding:0 16px">` +
      `<h1>${escapeHtml(doc.title || "Untitled")}</h1><pre style="white-space:pre-wrap;font:inherit">${escapeHtml(doc.content)}</pre></body>`;
    mime = "text/html";
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
};

// ── AI edit action prompts ──────────────────────────────────────────────────────
export type AiAction = "improve" | "grammar" | "summarize" | "continue" | "custom";

export const buildAiPrompt = (action: AiAction, content: string, custom?: string): string => {
  const doc = content.trim();
  switch (action) {
    case "improve":
      return `Improve the following text — make it clearer, tighter, and better structured while preserving meaning and voice. Return ONLY the rewritten text, no commentary.\n\n---\n${doc}`;
    case "grammar":
      return `Fix spelling, grammar, and punctuation in the following text. Keep the wording and meaning otherwise unchanged. Return ONLY the corrected text.\n\n---\n${doc}`;
    case "summarize":
      return `Summarize the following text into a few concise bullet points. Return ONLY the summary.\n\n---\n${doc}`;
    case "continue":
      return `Continue writing the following text naturally, matching its tone and style. Return ONLY the continuation (the new text to append), not a repeat of what's above.\n\n---\n${doc}`;
    case "custom":
      return `${custom || "Edit the following text."}\n\nReturn ONLY the resulting text.\n\n---\n${doc}`;
  }
};
