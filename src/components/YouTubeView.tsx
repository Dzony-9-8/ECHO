import { useState } from "react";
import { motion } from "framer-motion";
import { Youtube, Search, Loader2, Copy, Check, Sparkles, AlertTriangle, ExternalLink, ListTree } from "lucide-react";
import { toast } from "sonner";
import { getBackendUrl } from "@/lib/api";

interface Transcript {
  available: boolean;
  blocked?: boolean;
  text?: string;
  lang?: string;
  kind?: string;
  languages?: string[];
  reason?: string;
  segments?: { start: number; dur: number; text: string }[];
}

interface VideoResult {
  video_id?: string;
  url?: string;
  metadata?: { title?: string; author?: string; author_url?: string; thumbnail?: string };
  transcript?: Transcript;
  error?: string;
}

interface Props {
  onSendToChat?: (prompt: string) => void;
}

const YouTubeView = ({ onSendToChat }: Props) => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VideoResult | null>(null);
  const [manual, setManual] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchVideo = async () => {
    const u = url.trim();
    if (!u) return;
    setLoading(true);
    setResult(null);
    setManual("");
    try {
      const res = await fetch(`${getBackendUrl()}/api/youtube`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      if (!res.ok) throw new Error(`request failed (${res.status})`);
      const data: VideoResult = await res.json();
      setResult(data);
      if (data.error) toast.error(data.error);
    } catch (e) {
      toast.error(`Couldn't reach the backend: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setLoading(false);
    }
  };

  // Whatever transcript text we actually have — fetched or pasted by the user.
  const transcriptText = result?.transcript?.available ? (result.transcript.text ?? "") : manual;
  const meta = result?.metadata;

  const copyTranscript = async () => {
    if (!transcriptText) return;
    try {
      await navigator.clipboard.writeText(transcriptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Transcript copied");
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const sendToChat = (instruction: string) => {
    if (!transcriptText.trim()) { toast.error("No transcript text yet"); return; }
    const header = meta?.title ? `Video: "${meta.title}"${meta.author ? ` by ${meta.author}` : ""}\n\n` : "";
    onSendToChat?.(`${instruction}\n\n${header}Transcript:\n${transcriptText}`);
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Youtube className="w-5 h-5 text-terminal-red" style={{ filter: "drop-shadow(0 0 6px hsl(0 70% 55% / 0.6))" }} />
        <div>
          <h1 className="text-lg font-display tracking-wider text-foreground">YouTube</h1>
          <p className="text-[10px] font-mono text-muted-foreground">Pull a video's details and transcript into the agent</p>
        </div>
      </div>

      {/* URL input */}
      <div className="flex items-center gap-2 mb-5">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") fetchVideo(); }}
          placeholder="Paste a YouTube URL…"
          className="flex-1 bg-input border border-border rounded px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
        />
        <button
          onClick={fetchVideo}
          disabled={!url.trim() || loading}
          className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest px-4 py-2 rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          {loading ? "Fetching" : "Fetch"}
        </button>
      </div>

      {result?.error && (
        <div className="px-3 py-2.5 rounded-lg border border-terminal-red/40 bg-terminal-red/10 text-[11px] font-mono text-terminal-red">
          {result.error}
        </div>
      )}

      {result && !result.error && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Metadata */}
          <div className="flex gap-3 p-3 rounded-lg border border-border bg-card/40">
            {meta?.thumbnail && (
              <img src={meta.thumbnail} alt="" className="w-32 h-auto rounded border border-border flex-shrink-0 object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-mono text-foreground leading-snug">{meta?.title || "(title unavailable)"}</h2>
              {meta?.author && <p className="text-[11px] font-mono text-terminal-cyan mt-0.5">{meta.author}</p>}
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground mt-1.5"
              >
                <ExternalLink className="w-3 h-3" /> {result.video_id}
              </a>
            </div>
          </div>

          {/* Caption languages — real data even when the text can't be fetched */}
          {result.transcript?.languages && result.transcript.languages.length > 0 && (
            <div className="flex items-start gap-2 text-[10px] font-mono text-muted-foreground">
              <ListTree className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-terminal-cyan" />
              <span>
                {result.transcript.languages.length} caption track{result.transcript.languages.length === 1 ? "" : "s"}:{" "}
                <span className="text-foreground">{result.transcript.languages.slice(0, 12).join(", ")}</span>
                {result.transcript.languages.length > 12 && ` +${result.transcript.languages.length - 12} more`}
              </span>
            </div>
          )}

          {/* Transcript — fetched, or an honest explanation + manual paste */}
          {result.transcript?.available ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                  Transcript · {result.transcript.lang} · {result.transcript.kind} · {result.transcript.segments?.length ?? 0} segments
                </span>
                <button onClick={copyTranscript} className="flex items-center gap-1 text-[9px] font-mono px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground">
                  {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />} Copy
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 text-[11px] font-mono text-foreground whitespace-pre-wrap leading-relaxed">
                {result.transcript.text}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-terminal-amber/40 bg-terminal-amber/10">
                <AlertTriangle className="w-4 h-4 text-terminal-amber flex-shrink-0 mt-0.5" />
                <p className="text-[10px] font-mono text-terminal-amber leading-relaxed">{result.transcript?.reason}</p>
              </div>
              <div>
                <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
                  Paste the transcript here to use the AI tools
                </label>
                <textarea
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  rows={7}
                  placeholder="Open the video → “…more” → “Show transcript”, then copy it in here."
                  className="w-full mt-1 bg-input border border-border rounded px-3 py-2 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>
          )}

          {/* AI actions — operate on whatever transcript text exists */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: "Summarize", instruction: "Summarize this video transcript into clear bullet points." },
              { label: "Key takeaways", instruction: "List the key takeaways and insights from this video transcript." },
              { label: "Ask about it", instruction: "I want to ask questions about this video. Read the transcript and give me a short overview first." },
            ].map((a) => (
              <button
                key={a.label}
                onClick={() => sendToChat(a.instruction)}
                disabled={!transcriptText.trim()}
                className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 rounded border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30"
              >
                <Sparkles className="w-3.5 h-3.5" /> {a.label}
              </button>
            ))}
            {transcriptText.trim() && (
              <span className="text-[9px] font-mono text-muted-foreground/60">
                {transcriptText.trim().split(/\s+/).length.toLocaleString()} words
              </span>
            )}
          </div>
        </motion.div>
      )}

      {!result && !loading && (
        <div className="text-center py-12 text-muted-foreground/50 font-mono text-xs">
          <Youtube className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Paste a YouTube URL to fetch its details and transcript.
        </div>
      )}

      <p className="text-[9px] font-mono text-muted-foreground/50 mt-6 text-center">
        Details come from YouTube's public oEmbed endpoint. Caption text is fetched when YouTube allows it — otherwise paste it in and the AI tools still work.
      </p>
    </div>
  );
};

export default YouTubeView;
