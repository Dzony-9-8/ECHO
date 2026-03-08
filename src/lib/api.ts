// Configuration for connecting to local FastAPI backend
const DEFAULT_BACKEND_URL = "http://localhost:8000";

export const getBackendUrl = (): string => {
  return localStorage.getItem("echo_backend_url") || DEFAULT_BACKEND_URL;
};

export const setBackendUrl = (url: string) => {
  localStorage.setItem("echo_backend_url", url);
};

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  model?: string;
  agent?: string;
  status?: "pending" | "streaming" | "complete" | "error";
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
}

// Send chat message to backend
export const sendMessage = async (
  messages: ChatMessage[],
  onChunk?: (chunk: string) => void
): Promise<string> => {
  const url = getBackendUrl();

  try {
    const response = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) throw new Error(`Backend error: ${response.status}`);

    // Handle streaming response
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
  } catch (error) {
    throw error;
  }
};

// Check backend health
export const checkHealth = async (): Promise<SystemStatus> => {
  const url = getBackendUrl();
  try {
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error();
    return await response.json();
  } catch {
    return {
      backend: "offline",
      gpu: null,
      models_loaded: [],
      uptime: 0,
    };
  }
};
