import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { getBackendUrl } from "@/lib/api";

interface Props {
  model: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ModelPullDialog({ model, open, onClose, onSuccess }: Props) {
  const [status, setStatus] = useState("Ready to pull");
  const [progress, setProgress] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [done, setDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const startPull = async () => {
    setPulling(true);
    setStatus("Starting…");
    setProgress(0);
    setDone(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const url = getBackendUrl();
      const res = await fetch(`${url}/api/models/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) { setPulling(false); return; }
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buf += dec.decode(value, { stream: true });

        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const ev = JSON.parse(json);
            if (ev.error) {
              setStatus(`Error: ${ev.error}`);
              setPulling(false);
              return;
            }
            if (ev.total && ev.completed) {
              setProgress(Math.round((ev.completed / ev.total) * 100));
            }
            if (ev.status) setStatus(ev.status);
            if (ev.done) {
              setStatus("Pull complete!");
              setDone(true);
              setPulling(false);
              onSuccess();
              return;
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setStatus(`Error: ${e?.message || "unknown"}`);
      }
    } finally {
      setPulling(false);
    }
  };

  const handleClose = () => {
    abortRef.current?.abort();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pull {model}</DialogTitle>
          <DialogDescription>
            Download this model from Ollama's registry to use it locally.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground font-mono">{status}</p>
        {progress > 0 && <Progress value={progress} className="mt-2" />}
        {!pulling && !done && (
          <Button onClick={startPull} className="mt-4 w-full">
            Start Pull
          </Button>
        )}
        {pulling && (
          <Button variant="outline" onClick={handleClose} className="mt-4 w-full">
            Cancel
          </Button>
        )}
        {done && (
          <Button onClick={handleClose} className="mt-4 w-full">
            Done
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
