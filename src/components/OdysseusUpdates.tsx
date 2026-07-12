import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Ship, GitCommit, RefreshCw, ExternalLink, CheckCheck,
  AlertTriangle, ArrowUpCircle, ShieldCheck, Info,
} from "lucide-react";
import { getBackendUrl } from "@/lib/api";
import { toast } from "sonner";

interface OdysseusCommit {
  sha: string;
  full_sha: string;
  subject: string;
  author: string;
  date: string;
  url: string;
}

interface OdysseusReport {
  owner: string;
  repo: string;
  branch: string;
  repo_url: string;
  acked_sha: string | null;
  acked_at: string | null;
  latest_sha: string | null;
  has_updates: boolean;
  behind_by: number;
  first_run: boolean;
  commits: OdysseusCommit[];
  compare_url: string | null;
  error: string | null;
  rate_limited: boolean;
  authenticated: boolean;
}

const fmtDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
};

const OdysseusUpdates = () => {
  const [report, setReport] = useState<OdysseusReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [acking, setAcking] = useState(false);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/odysseus/updates/check`);
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      const data: OdysseusReport = await res.json();
      setReport(data);
      if (data.error) toast.error(data.error);
    } catch (e) {
      toast.error("Could not reach the backend to check Odysseus updates");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  const markReviewed = async () => {
    if (!report?.latest_sha) return;
    setAcking(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/odysseus/updates/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sha: report.latest_sha }),
      });
      if (!res.ok) throw new Error();
      toast.success("Baseline updated — future checks show only newer commits");
      await check();
    } catch {
      toast.error("Failed to update baseline");
    } finally {
      setAcking(false);
    }
  };

  // ── Status banner ──────────────────────────────────────────────────────────
  const renderStatus = () => {
    if (!report) return null;
    if (report.rate_limited || report.error) {
      return (
        <div className="flex items-start gap-2 p-3 rounded border border-terminal-red/40 bg-terminal-red/5 text-terminal-red text-[11px] font-mono">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{report.error || "GitHub API error"}</span>
        </div>
      );
    }
    if (report.first_run) {
      return (
        <div className="flex items-start gap-2 p-3 rounded border border-terminal-cyan/40 bg-terminal-cyan/5 text-terminal-cyan text-[11px] font-mono">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            No baseline set yet. Below is recent Odysseus history. Click <strong>Mark reviewed</strong> to
            start tracking new changes from the latest commit onward.
          </span>
        </div>
      );
    }
    if (report.has_updates) {
      return (
        <div className="flex items-start gap-2 p-3 rounded border border-terminal-amber/50 bg-terminal-amber/5 text-terminal-amber text-[11px] font-mono">
          <ArrowUpCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>{report.behind_by} new commit{report.behind_by !== 1 ? "s" : ""}</strong> upstream on
            <code className="mx-1">{report.branch}</code> since you last reviewed. These are upstream changes to
            port deliberately — ECHO and Odysseus are different stacks, so nothing is applied automatically.
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-start gap-2 p-3 rounded border border-primary/40 bg-primary/5 text-primary text-[11px] font-mono">
        <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>Up to date — no new Odysseus commits on <code className="mx-1">{report.branch}</code> since your last review.</span>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card p-3 flex items-center gap-3 flex-wrap">
        <Ship className="w-4 h-4 text-terminal-cyan" />
        <span className="text-xs font-mono text-terminal-cyan uppercase tracking-wider">Odysseus Updates</span>
        {report && (
          <a
            href={report.repo_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            {report.owner}/{report.repo}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <div className="flex-1" />
        {report?.compare_url && (
          <a
            href={report.compare_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
          >
            <GitCommit className="w-3.5 h-3.5" />
            View diff on GitHub
          </a>
        )}
        <button
          onClick={markReviewed}
          disabled={acking || loading || !report?.latest_sha}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-terminal-amber/50 bg-terminal-amber/10 text-terminal-amber text-[10px] font-mono hover:bg-terminal-amber/20 transition-all disabled:opacity-40"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          Mark reviewed
        </button>
        <button
          onClick={check}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-terminal-cyan/50 bg-terminal-cyan/10 text-terminal-cyan text-[10px] font-mono hover:bg-terminal-cyan/20 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Checking..." : "Check for Updates"}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {renderStatus()}

        {report && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[9px] font-mono text-muted-foreground/60 px-1">
            <span>branch: <span className="text-muted-foreground">{report.branch}</span></span>
            {report.latest_sha && <span>latest: <span className="text-muted-foreground">{report.latest_sha.slice(0, 10)}</span></span>}
            {report.acked_sha && <span>baseline: <span className="text-muted-foreground">{report.acked_sha.slice(0, 10)}</span></span>}
            {report.acked_at && <span>reviewed: <span className="text-muted-foreground">{fmtDate(report.acked_at)}</span></span>}
            <span>auth: <span className="text-muted-foreground">{report.authenticated ? "token" : "anonymous"}</span></span>
          </div>
        )}

        {/* Commit list */}
        {report && report.commits.length > 0 && (
          <div className="space-y-1.5">
            {report.commits.map((c, i) => (
              <motion.a
                key={c.full_sha || i}
                href={c.url}
                target="_blank"
                rel="noreferrer"
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: Math.min(i * 0.01, 0.3) }}
                className="flex items-start gap-2.5 p-2.5 rounded border border-border bg-card hover:border-terminal-cyan/40 hover:bg-muted/30 transition-all group"
              >
                <GitCommit className="w-3.5 h-3.5 text-terminal-cyan/60 flex-shrink-0 mt-0.5 group-hover:text-terminal-cyan" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-mono text-foreground break-words">{c.subject}</div>
                  <div className="text-[9px] font-mono text-muted-foreground/50 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="text-terminal-cyan/50">{c.sha}</span>
                    <span>{c.author}</span>
                    {c.date && <span>· {fmtDate(c.date)}</span>}
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 text-muted-foreground/30 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.a>
            ))}
          </div>
        )}

        {report && !report.error && report.commits.length === 0 && !report.first_run && (
          <div className="text-center text-[11px] font-mono text-muted-foreground/50 py-12">
            No commits to show.
          </div>
        )}

        {!report && !loading && (
          <div className="text-center text-[11px] font-mono text-muted-foreground/50 py-12">
            Click "Check for Updates" to query the Odysseus repository.
          </div>
        )}
      </div>
    </div>
  );
};

export default OdysseusUpdates;
