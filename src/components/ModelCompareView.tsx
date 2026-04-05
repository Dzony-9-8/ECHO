import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sendMessage, fetchLocalModels, type ChatMessage } from "@/lib/api";
import { toast } from "sonner";

export default function ModelCompareView() {
  const [models, setModels] = useState<string[]>([]);
  const [modelA, setModelA] = useState("");
  const [modelB, setModelB] = useState("");
  const [prompt, setPrompt] = useState("");
  const [responseA, setResponseA] = useState("");
  const [responseB, setResponseB] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLocalModels().then((m) => {
      const names = m.map((x) => x.name);
      setModels(names);
      if (names.length >= 1) setModelA(names[0]);
      if (names.length >= 2) setModelB(names[1]);
    });
  }, []);

  const compare = async () => {
    if (!prompt.trim() || !modelA || !modelB) return;
    setLoading(true);
    setResponseA("");
    setResponseB("");

    const msgs: ChatMessage[] = [{ id: "u1", role: "user", content: prompt, timestamp: new Date() }];

    try {
      await Promise.all([
        sendMessage(msgs, (t) => setResponseA(t), 1, modelA),
        sendMessage(msgs, (t) => setResponseB(t), 1, modelB),
      ]);
    } catch (e: any) {
      toast.error(e?.message || "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <h2 className="text-lg font-semibold">Model Comparison</h2>
      <div className="flex gap-2">
        <Select value={modelA} onValueChange={setModelA}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Model A" /></SelectTrigger>
          <SelectContent>{models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={modelB} onValueChange={setModelB}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Model B" /></SelectTrigger>
          <SelectContent>{models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Textarea
        placeholder="Enter your prompt… (Ctrl+Enter to compare)"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            compare();
          }
        }}
      />
      <Button onClick={compare} disabled={loading || !modelA || !modelB || !prompt.trim()}>
        {loading ? "Comparing…" : "Compare Models"}
      </Button>
      <div className="grid grid-cols-2 gap-4 flex-1 overflow-auto">
        <div className="border rounded p-3">
          <p className="text-xs font-mono text-muted-foreground mb-2">{modelA}</p>
          <pre className="text-sm whitespace-pre-wrap">{responseA || (loading ? "Streaming…" : "—")}</pre>
        </div>
        <div className="border rounded p-3">
          <p className="text-xs font-mono text-muted-foreground mb-2">{modelB}</p>
          <pre className="text-sm whitespace-pre-wrap">{responseB || (loading ? "Streaming…" : "—")}</pre>
        </div>
      </div>
    </div>
  );
}
