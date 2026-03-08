// Agent status tracking — manages which agent is currently processing
// For local backend: polls /api/agents endpoint
// For cloud mode: uses frontend-side status tracking

import { getBackendMode, getBackendUrl } from "@/lib/api";

export interface AgentStatus {
  name: string;
  status: "idle" | "active" | "processing" | "complete" | "error";
  model: string;
  currentTask?: string;
  lastActive?: string;
  tokensProcessed: number;
  totalResponseMs: number;
  requestCount: number;
}

export interface AgentsResponse {
  agents: AgentStatus[];
  activeAgent?: string;
  pipeline?: string[];
}

const PIPELINE = ["Supervisor", "Researcher", "Developer", "Critic"] as const;
export { PIPELINE };

// Default cloud agent state
const defaultCloudAgents: AgentStatus[] = [
  { name: "ECHO Cloud", status: "idle", model: "Gemini 3 Flash", tokensProcessed: 0, totalResponseMs: 0, requestCount: 0 },
];

// Default local agent states
const defaultLocalAgents: AgentStatus[] = [
  { name: "Supervisor", status: "idle", model: "LLaMA 3.1", tokensProcessed: 0, totalResponseMs: 0, requestCount: 0 },
  { name: "Researcher", status: "idle", model: "DeepSeek R1", tokensProcessed: 0, totalResponseMs: 0, requestCount: 0 },
  { name: "Developer", status: "idle", model: "DeepSeek Coder V2", tokensProcessed: 0, totalResponseMs: 0, requestCount: 0 },
  { name: "Critic", status: "idle", model: "DeepSeek R1", tokensProcessed: 0, totalResponseMs: 0, requestCount: 0 },
];

// Persistent metrics in localStorage
const METRICS_KEY = "echo_agent_metrics";

interface AgentMetrics {
  tokensProcessed: number;
  totalResponseMs: number;
  requestCount: number;
}

const loadMetrics = (): Record<string, AgentMetrics> => {
  try {
    return JSON.parse(localStorage.getItem(METRICS_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveMetrics = (metrics: Record<string, AgentMetrics>) => {
  localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
};

// Apply saved metrics to agent list
const applyMetrics = (agents: AgentStatus[]): AgentStatus[] => {
  const metrics = loadMetrics();
  return agents.map((a) => {
    const m = metrics[a.name];
    return m
      ? { ...a, tokensProcessed: m.tokensProcessed, totalResponseMs: m.totalResponseMs, requestCount: m.requestCount }
      : a;
  });
};

// Fetch agent status from local backend
export const fetchAgentStatus = async (): Promise<AgentsResponse> => {
  const mode = getBackendMode();

  if (mode === "local") {
    const url = getBackendUrl();
    try {
      const response = await fetch(`${url}/api/agents`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error();
      return await response.json();
    } catch {
      return { agents: applyMetrics(defaultLocalAgents), pipeline: [...PIPELINE] };
    }
  }

  return { agents: applyMetrics(defaultCloudAgents) };
};

// --- Client-side agent status tracking ---

type Listener = (agents: AgentStatus[], activeAgent: string | null, pipelineStep: number) => void;

let _agents: AgentStatus[] = applyMetrics([...defaultCloudAgents]);
let _activeAgent: string | null = null;
let _pipelineStep = -1; // -1 = not in pipeline
let _activeStartTime = 0;
const _listeners = new Set<Listener>();

const notify = () => {
  for (const fn of _listeners) fn([..._agents], _activeAgent, _pipelineStep);
};

export const subscribeAgentStatus = (fn: Listener): (() => void) => {
  _listeners.add(fn);
  fn([..._agents], _activeAgent, _pipelineStep);
  return () => _listeners.delete(fn);
};

export const setAgentActive = (agentName: string, task?: string) => {
  _activeStartTime = Date.now();
  const mode = getBackendMode();
  const base = mode === "cloud" ? defaultCloudAgents : defaultLocalAgents;
  _agents = applyMetrics(base).map((a) =>
    a.name === agentName
      ? { ...a, status: "active" as const, currentTask: task, lastActive: new Date().toISOString() }
      : { ...a, status: "idle" as const }
  );
  _activeAgent = agentName;
  _pipelineStep = PIPELINE.indexOf(agentName as any);
  if (_pipelineStep === -1 && agentName === "ECHO Cloud") _pipelineStep = 0;
  notify();
};

export const setAgentProcessing = (agentName: string) => {
  _agents = _agents.map((a) =>
    a.name === agentName ? { ...a, status: "processing" as const } : a
  );
  notify();
};

export const setAgentComplete = (agentName: string, tokens?: number) => {
  const elapsed = Date.now() - _activeStartTime;
  const metrics = loadMetrics();
  const m = metrics[agentName] || { tokensProcessed: 0, totalResponseMs: 0, requestCount: 0 };
  m.tokensProcessed += tokens || 0;
  m.totalResponseMs += elapsed;
  m.requestCount += 1;
  metrics[agentName] = m;
  saveMetrics(metrics);

  _agents = _agents.map((a) =>
    a.name === agentName
      ? { ...a, status: "complete" as const, tokensProcessed: m.tokensProcessed, totalResponseMs: m.totalResponseMs, requestCount: m.requestCount }
      : a
  );
  _activeAgent = null;
  _pipelineStep = -1;
  notify();
};

export const resetAllAgents = () => {
  const mode = getBackendMode();
  _agents = applyMetrics(mode === "cloud" ? [...defaultCloudAgents] : [...defaultLocalAgents]);
  _activeAgent = null;
  _pipelineStep = -1;
  notify();
};

export const resetMetrics = () => {
  localStorage.removeItem(METRICS_KEY);
  resetAllAgents();
};

export const getDefaultAgents = () => {
  const mode = getBackendMode();
  return mode === "cloud" ? defaultCloudAgents : defaultLocalAgents;
};
