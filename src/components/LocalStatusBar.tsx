import { useEffect, useState } from "react";
import { getBackendMode, getBackendUrl } from "@/lib/api";

type Status = "online" | "reconnecting" | "offline";

const LocalStatusBar = () => {
  const [status, setStatus] = useState<Status>("online");
  const [model, setModel] = useState<string>("");

  useEffect(() => {
    if (getBackendMode() !== "local") return;

    const check = async () => {
      const url = getBackendUrl();
      try {
        const res = await fetch(`${url}/api/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const data = await res.json();
          setModel((data as { models_loaded?: string[] }).models_loaded?.[0] || "");
          setStatus("online");
        } else {
          setStatus("reconnecting");
        }
      } catch {
        setStatus((prev) => (prev === "online" ? "reconnecting" : "offline"));
      }
    };

    check();
    const id = setInterval(check, 10_000);
    return () => clearInterval(id);
  }, []);

  if (getBackendMode() !== "local") return null;

  const colors: Record<Status, string> = {
    online: "bg-green-500",
    reconnecting: "bg-yellow-500",
    offline: "bg-red-500",
  };

  const labels: Record<Status, string> = {
    online: model ? `Ollama · ${model}` : "Ollama · Online",
    reconnecting: "Ollama · Reconnecting…",
    offline: "Ollama · Offline",
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-muted-foreground">
      <span className={`inline-block h-2 w-2 rounded-full ${colors[status]}`} />
      <span>{labels[status]}</span>
    </div>
  );
};

export default LocalStatusBar;
