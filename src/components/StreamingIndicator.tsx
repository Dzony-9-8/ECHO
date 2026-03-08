import { useEffect, useState } from "react";
import { Zap, Clock } from "lucide-react";
import { estimateTokens } from "@/lib/tokens";

interface Props {
  content: string;
  startTime: number;
  isStreaming: boolean;
}

const StreamingIndicator = ({ content, startTime, isStreaming }: Props) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [isStreaming, startTime]);

  if (!isStreaming || !content) return null;

  const tokens = estimateTokens(content);
  const seconds = elapsed / 1000;
  const tokensPerSec = seconds > 0.3 ? (tokens / seconds).toFixed(1) : "—";

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 text-[10px] font-mono text-muted-foreground">
      <span className="flex items-center gap-1">
        <Zap className="w-3 h-3 text-terminal-amber animate-pulse" />
        {tokensPerSec} tok/s
      </span>
      <span className="flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {seconds.toFixed(1)}s
      </span>
      <span>~{tokens} tokens</span>
      <div className="flex-1 max-w-24 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary/60 rounded-full transition-all duration-300"
          style={{ width: `${Math.min((tokens / 2048) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
};

export default StreamingIndicator;
