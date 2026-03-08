// Configuration for connecting to backends
const DEFAULT_BACKEND_URL = "http://localhost:8000";

// Cloud backend URL (Lovable Cloud edge function)
const CLOUD_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export const getBackendUrl = (): string => {
  return localStorage.getItem("echo_backend_url") || DEFAULT_BACKEND_URL;
};

export const setBackendUrl = (url: string) => {
  localStorage.setItem("echo_backend_url", url);
};

export type BackendMode = "cloud" | "local";

export const getBackendMode = (): BackendMode => {
  return (localStorage.getItem("echo_backend_mode") as BackendMode) || "cloud";
};

export const setBackendMode = (mode: BackendMode) => {
  localStorage.setItem("echo_backend_mode", mode);
};

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  model?: string;
  agent?: string;
  status?: "pending" | "streaming" | "complete" | "error";
  files?: { name: string; type: "image" | "document"; preview?: string }[];
}

export interface AgentInfo {
  name: string;
  model: string;
  status: "idle" | "active" | "processing";
  description: string;
}

export interface SystemStatus {
  backend: "online" | "offline";
  gpu: { name: string; vram_used: number; vram_total: number } | null;
  models_loaded: string[];
  uptime: number;
  mode: BackendMode;
}

// Real-time system metrics from local backend
export interface RealSystemMetrics {
  cpu: {
    name: string;
    cores: number;
    threads: number;
    usage_percent: number;
    temperature_c: number | null;
  };
  ram: {
    total_gb: number;
    used_gb: number;
    usage_percent: number;
  };
  gpu: {
    name: string;
    vram_total_mb: number;
    vram_used_mb: number;
    gpu_usage_percent: number;
    temperature_c: number | null;
  } | null;
  disk: {
    total_gb: number;
    used_gb: number;
    free_gb: number;
    usage_percent: number;
  } | null;
  platform: string;
  hostname: string;
}

// Measure cloud backend latency (ms)
export const measureCloudLatency = async (): Promise<number | null> => {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
  try {
    const start = performance.now();
    await fetch(url, {
      method: "OPTIONS",
      signal: AbortSignal.timeout(5000),
    });
    return Math.round(performance.now() - start);
  } catch {
    return null;
  }
};

// Fetch real system metrics from local backend
export const fetchSystemMetrics = async (): Promise<RealSystemMetrics | null> => {
  const mode = getBackendMode();
  if (mode !== "local") return null;

  const url = getBackendUrl();
  try {
    const response = await fetch(`${url}/api/system`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

// Parse SSE stream token-by-token
const parseSSEStream = async (
  response: Response,
  onDelta: (text: string) => void
): Promise<string> => {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") break;

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) {
          fullText += content;
          onDelta(fullText);
        }
      } catch {
        // Partial JSON, put back and wait
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  // Flush remaining
  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) {
          fullText += content;
          onDelta(fullText);
        }
      } catch {
        /* ignore */
      }
    }
  }

  return fullText;
};

// Send via Cloud (Lovable AI edge function)
const sendCloudMessage = async (
  messages: ChatMessage[],
  depth: number,
  onChunk?: (text: string) => void
): Promise<string> => {
  const response = await fetch(CLOUD_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      depth,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const msg = (errorData as { error?: string }).error || `Cloud error: ${response.status}`;
    throw new Error(msg);
  }

  if (onChunk) {
    return parseSSEStream(response, onChunk);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
};

// Send via local FastAPI backend
const sendLocalMessage = async (
  messages: ChatMessage[],
  onChunk?: (text: string) => void
): Promise<string> => {
  const url = getBackendUrl();
  const response = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) throw new Error(`Backend error: ${response.status}`);

  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullText += chunk;
        onChunk?.(fullText);
      }
    }
    return fullText;
  }

  const data = await response.json();
  return data.response || data.content || "";
};

// Main send function — routes to cloud or local
export const sendMessage = async (
  messages: ChatMessage[],
  onChunk?: (text: string) => void,
  depth: number = 1
): Promise<string> => {
  const mode = getBackendMode();

  if (mode === "local") {
    return sendLocalMessage(messages, onChunk);
  }

  return sendCloudMessage(messages, depth, onChunk);
};

// Check backend health
export const checkHealth = async (): Promise<SystemStatus> => {
  const mode = getBackendMode();

  if (mode === "local") {
    const url = getBackendUrl();
    try {
      const response = await fetch(`${url}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      return { ...data, mode: "local" };
    } catch {
      return {
        backend: "offline",
        gpu: null,
        models_loaded: [],
        uptime: 0,
        mode: "local",
      };
    }
  }

  // Cloud is always "online" if we have the URL
  return {
    backend: "online",
    gpu: null,
    models_loaded: ["gemini-3-flash-preview (Cloud)"],
    uptime: 0,
    mode: "cloud",
  };
};
