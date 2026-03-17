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

export interface ChatStepEvent {
  agent: string;
  text: string;
  status: "start" | "done" | "error";
}

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
  onDelta: (text: string) => void,
  onStep?: (step: ChatStepEvent) => void
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
        if (parsed.type === "step" && onStep) {
          onStep({ agent: parsed.agent || "", text: parsed.text || "", status: parsed.status || "done" });
          continue;
        }
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
        if (parsed.type === "step" && onStep) {
          onStep({ agent: parsed.agent || "", text: parsed.text || "", status: parsed.status || "done" });
          continue;
        }
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
  onChunk?: (text: string) => void,
  model?: string
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
      model,
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
  onChunk?: (text: string) => void,
  model?: string,
  images?: string[],
  onStep?: (step: ChatStepEvent) => void,
  attachments?: Array<{ name: string; type: string; content: string }>
): Promise<string> => {
  // Load pipeline settings from localStorage
  let enablePlanning = true;
  let enableReflection = false;
  let noCache = false;
  try {
    const settings = JSON.parse(localStorage.getItem("echo_chat_settings") || "{}");
    enablePlanning = settings.enablePlanning ?? true;
    enableReflection = settings.enableReflection ?? false;
    noCache = settings.noCache ?? false;
  } catch { /* use defaults */ }

  const url = getBackendUrl();
  const response = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      model: model || undefined,
      enable_planning: enablePlanning,
      enable_reflection: enableReflection,
      no_cache: noCache,
      ...(images && images.length > 0 ? { images } : {}),
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    }),
  });

  if (!response.ok) throw new Error(`Backend error: ${response.status}`);

  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    if (onChunk) {
      return parseSSEStream(response, onChunk, onStep);
    }
    // No streaming callback — collect full text from SSE
    return parseSSEStream(response, () => {}, onStep);
  }

  const data = await response.json();
  return data.response || data.content || "";
};

// Main send function — routes to cloud or local
export const sendMessage = async (
  messages: ChatMessage[],
  onChunk?: (text: string) => void,
  depth: number = 1,
  model?: string,
  images?: string[],
  onStep?: (step: ChatStepEvent) => void,
  attachments?: Array<{ name: string; type: string; content: string }>
): Promise<string> => {
  const mode = getBackendMode();

  if (mode === "local") {
    return sendLocalMessage(messages, onChunk, model, images, onStep, attachments);
  }

  return sendCloudMessage(messages, depth, onChunk, model);
};

// Process an uploaded file — extract text from PDF/DOCX/text files
export const processFile = async (
  name: string,
  file: File
): Promise<{ text: string; type: string; word_count: number }> => {
  const url = getBackendUrl();
  const b64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const resp = await fetch(`${url}/api/files/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, content_b64: b64, mime_type: file.type }),
  });
  if (!resp.ok) throw new Error(`File processing failed: ${resp.status}`);
  return resp.json();
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

// ─── Memory API ────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  type: "episodic" | "semantic" | "procedural";
  content: string;
  summary: string;
  tags: string[];
  similarity?: number;
  timestamp?: string;
}

export const storeMemory = async (
  type: "episodic" | "semantic" | "procedural",
  content: string,
  summary?: string,
  tags?: string[]
): Promise<{ id: string } | null> => {
  const url = getBackendUrl();
  try {
    const resp = await fetch(`${url}/api/memory/store`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, content, summary, tags }),
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
};

export const recallMemories = async (
  query: string,
  limit = 5,
  type?: string
): Promise<MemoryEntry[]> => {
  const url = getBackendUrl();
  try {
    const resp = await fetch(`${url}/api/memory/recall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit, type }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.results || [];
  } catch {
    return [];
  }
};

export const listMemories = async (type = "all"): Promise<MemoryEntry[]> => {
  const url = getBackendUrl();
  try {
    const resp = await fetch(`${url}/api/memory/list?type=${type}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.memories || [];
  } catch {
    return [];
  }
};

export const deleteMemory = async (id: string): Promise<boolean> => {
  const url = getBackendUrl();
  try {
    const resp = await fetch(`${url}/api/memory/${id}`, { method: "DELETE" });
    return resp.ok;
  } catch {
    return false;
  }
};

// ─── Cache API ─────────────────────────────────────────────────────

export const getCacheStats = async (): Promise<{
  entries: number;
  hits: number;
  misses: number;
  hit_rate: number;
} | null> => {
  const url = getBackendUrl();
  try {
    const resp = await fetch(`${url}/api/cache/stats`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
};

export const clearCache = async (): Promise<boolean> => {
  const url = getBackendUrl();
  try {
    const resp = await fetch(`${url}/api/cache`, { method: "DELETE" });
    return resp.ok;
  } catch {
    return false;
  }
};

// ─── Local Models API (Item 2) ──────────────────────────────────────

export interface LocalModel {
  name: string;
  loaded: boolean;
  type: string;
  strengths: string[];
  estimated_vram_mb: number;
  vram_percent?: number;
}

export const fetchLocalModels = async (): Promise<LocalModel[]> => {
  const url = getBackendUrl();
  try {
    const resp = await fetch(`${url}/api/models`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.models || [];
  } catch {
    return [];
  }
};

// ─── Telemetry API (Item 4) ─────────────────────────────────────────

export interface TelemetryData {
  uptime: number;
  vram: { used_mb: number; total_mb: number; percent: number };
  cache: {
    entries: number;
    max_size: number;
    hits: number;
    misses: number;
    hit_rate: number;
    ttl_seconds: number;
  };
  agents: {
    name: string;
    tasks: number;
    avgTimeMs: number;
    tokensProcessed: number;
    status: string;
  }[];
  pipeline_queue: number;
  models_loaded: string[];
}

export const fetchTelemetry = async (): Promise<TelemetryData | null> => {
  const url = getBackendUrl();
  try {
    const resp = await fetch(`${url}/api/telemetry`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
};

// ─── Feedback API (Item 7) ──────────────────────────────────────────

export const submitFeedback = async (
  messageId: string,
  rating: number,
  comment?: string
): Promise<boolean> => {
  const url = getBackendUrl();
  try {
    const resp = await fetch(`${url}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId, rating, comment }),
    });
    return resp.ok;
  } catch {
    return false;
  }
};

// ─── Model Management API (Item 8) ─────────────────────────────────

export const manageModel = async (
  model: string,
  action: "load" | "unload"
): Promise<boolean> => {
  const url = getBackendUrl();
  try {
    const resp = await fetch(`${url}/api/models/manage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, action }),
    });
    return resp.ok;
  } catch {
    return false;
  }
};

// ─── v3.2: Web Search API ────────────────────────────────────────────────────

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  scraped_text?: string;
}

export interface WebSearchResponse {
  results: WebSearchResult[];
  summary: string;
  query: string;
}

export const webSearch = async (
  query: string,
  scrape = true,
  maxResults = 5
): Promise<WebSearchResponse> => {
  const url = getBackendUrl();
  try {
    const resp = await fetch(`${url}/api/web-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, scrape, max_results: maxResults }),
    });
    if (!resp.ok) throw new Error();
    return await resp.json();
  } catch {
    return { results: [], summary: "Backend offline or web search unavailable.", query };
  }
};

// ─── v3.2: Knowledge Folder Status ──────────────────────────────────────────

export interface KnowledgeFileStatus {
  file: string;
  status: "ok" | "processing" | "error" | "empty";
  chunks: number;
  error: string | null;
  ingested_at?: string;
}

export interface KnowledgeStatus {
  folder: string;
  watchdog_active: boolean;
  files: KnowledgeFileStatus[];
}

export const fetchKnowledgeStatus = async (): Promise<KnowledgeStatus | null> => {
  const url = getBackendUrl();
  try {
    const resp = await fetch(`${url}/api/knowledge/status`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) throw new Error();
    return await resp.json();
  } catch {
    return null;
  }
};

// ── v3.3: Deep Research ──────────────────────────────────────────────────────

export interface DeepResearchLog {
  step: string;
  message: string;
  level?: number;
}

export interface DeepResearchResponse {
  query: string;
  report: string;
  log: DeepResearchLog[];
  sources: string[];
  findings_count: number;
}

export const deepResearch = async (
  query: string,
  depth: number = 2,
  breadth: number = 3,
): Promise<DeepResearchResponse | null> => {
  const url = getBackendUrl();
  try {
    const resp = await fetch(`${url}/api/deep-research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, depth, breadth }),
      signal: AbortSignal.timeout(180_000), // 3 min max
    });
    if (!resp.ok) throw new Error(`${resp.status}`);
    return await resp.json();
  } catch (e) {
    console.error("Deep research failed:", e);
    return null;
  }
};

// ── v3.3: Weather ────────────────────────────────────────────────────────────

export interface WeatherDailyEntry {
  date: string;
  max: number;
  min: number;
  code: number;
  precip_prob: number;
  precip_sum?: number;
  wind_max?: number;
  wind_dir?: number;
  uv_index?: number;
  sunrise?: string;
  sunset?: string;
}

export interface WeatherData {
  success: boolean;
  location?: string;
  temperature?: number;
  wind_speed?: number;
  wind_dir?: number;
  description?: string;
  formatted?: string;
  error?: string;
  units?: { temp: string; wind: string };
  feels_like?: number;
  humidity?: number;
  uv_index?: number;
  sunrise?: string;
  sunset?: string;
  daily?: WeatherDailyEntry[];
}

export const fetchWeather = async (location: string): Promise<WeatherData | null> => {
  const url = getBackendUrl();
  try {
    const resp = await fetch(`${url}/api/weather`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) throw new Error(`${resp.status}`);
    return await resp.json();
  } catch {
    return null;
  }
};

// ── v3.3: Code Runner ────────────────────────────────────────────────────────

export interface CodeRunResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

export const runCode = async (
  code: string,
  timeout: number = 8,
): Promise<CodeRunResult | null> => {
  const url = getBackendUrl();
  try {
    const resp = await fetch(`${url}/api/run-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, timeout }),
      signal: AbortSignal.timeout((timeout + 5) * 1000),
    });
    if (!resp.ok) throw new Error(`${resp.status}`);
    return await resp.json();
  } catch {
    return null;
  }
};

// ── Vision API ────────────────────────────────────────────────────────────────

export interface VisionStatus {
  available: boolean;
  model: string | null;
  supported_models: string[];
  install_hint: string | null;
}

export async function checkVisionStatus(): Promise<VisionStatus> {
  const base = getBackendUrl();
  const resp = await fetch(`${base}/api/vision/status`);
  if (!resp.ok) throw new Error("Vision status check failed");
  return resp.json();
}

export async function analyzeImage(
  imageB64: string,
  prompt?: string,
): Promise<{ description: string; model: string }> {
  const base = getBackendUrl();
  const resp = await fetch(`${base}/api/vision/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_b64: imageB64,
      prompt: prompt || "Describe this image in detail.",
    }),
  });
  if (!resp.ok) throw new Error("Vision analysis failed");
  return resp.json();
}
