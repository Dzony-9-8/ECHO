// Documents — a small writing-first document store.
//
// Drafts live on the backend (<writable>/data/documents.json) when it's
// reachable, so they survive a browser clear. When it isn't, we fall back to
// localStorage and the UI says so — we never pretend a draft was saved to disk.

import { getBackendUrl } from "@/lib/api";

export interface Doc {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

/** Where the drafts currently being edited actually live. */
export type StorageMode = "server" | "local";

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

// ── Server-side drafts (/api/drafts) ─────────────────────────────────────────
// Namespaced /api/drafts, not /api/documents — the latter is the RAG ingestion API.

const draftsUrl = () => `${getBackendUrl()}/api/drafts`;

const withTimeout = async (input: string, init: RequestInit = {}, ms = 5000): Promise<Response> => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
};

/** List server drafts. Throws when the backend is unreachable (caller falls back to local). */
export const remoteListDocs = async (): Promise<Doc[]> => {
  const res = await withTimeout(draftsUrl());
  if (!res.ok) throw new Error(`drafts list failed (${res.status})`);
  const data = await res.json();
  return Array.isArray(data.documents) ? data.documents : [];
};

export const remoteUpsertDoc = async (doc: Doc): Promise<Doc> => {
  const res = await withTimeout(draftsUrl(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
  if (!res.ok) throw new Error(`draft save failed (${res.status})`);
  return (await res.json()).document;
};

export const remoteDeleteDoc = async (id: string): Promise<void> => {
  const res = await withTimeout(`${draftsUrl()}/${encodeURIComponent(id)}`, { method: "DELETE" });
  // 404 means it's already gone — treat as success rather than blocking the UI.
  if (!res.ok && res.status !== 404) throw new Error(`draft delete failed (${res.status})`);
};

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
