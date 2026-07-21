// MCP server registry — manage Model Context Protocol server definitions.
// This is a CONFIG manager: it stores the standard mcpServers shape and can
// probe HTTP/SSE endpoints for reachability (via the backend, no CORS). It does
// NOT launch stdio processes — ECHO never spawns arbitrary commands here.

import { getBackendUrl } from "@/lib/api";

export type Transport = "stdio" | "http" | "sse";

export interface McpServer {
  id: string;
  name: string;              // unique-ish label / config key
  transport: Transport;
  command?: string;          // stdio: executable
  args?: string;             // stdio: space-separated args (stored raw)
  url?: string;              // http/sse: endpoint
  env?: string;              // KEY=value per line (both transports)
  enabled: boolean;
}

const KEY = "echo_mcp_servers";

export const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const loadServers = (): McpServer[] => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
};
export const saveServers = (list: McpServer[]) => localStorage.setItem(KEY, JSON.stringify(list));

export const upsertServer = (s: McpServer): McpServer[] => {
  const list = loadServers();
  const idx = list.findIndex((x) => x.id === s.id);
  if (idx >= 0) list[idx] = s;
  else list.push(s);
  saveServers(list);
  return list;
};
export const deleteServer = (id: string): McpServer[] => {
  const list = loadServers().filter((s) => s.id !== id);
  saveServers(list);
  return list;
};

export const blankServer = (): McpServer => ({
  id: newId(), name: "", transport: "stdio", command: "", args: "", url: "", env: "", enabled: true,
});

const parseEnv = (env?: string): Record<string, string> => {
  const out: Record<string, string> = {};
  (env || "").split("\n").forEach((line) => {
    const t = line.trim();
    if (!t || !t.includes("=")) return;
    const i = t.indexOf("=");
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  });
  return out;
};

/** Render the enabled servers as the standard mcpServers config object. */
export const toMcpConfig = (list: McpServer[] = loadServers()): { mcpServers: Record<string, unknown> } => {
  const mcpServers: Record<string, unknown> = {};
  for (const s of list) {
    if (!s.enabled || !s.name.trim()) continue;
    const env = parseEnv(s.env);
    if (s.transport === "stdio") {
      mcpServers[s.name] = {
        command: s.command || "",
        args: (s.args || "").split(/\s+/).filter(Boolean),
        ...(Object.keys(env).length ? { env } : {}),
      };
    } else {
      mcpServers[s.name] = {
        type: s.transport,
        url: s.url || "",
        ...(Object.keys(env).length ? { env } : {}),
      };
    }
  }
  return { mcpServers };
};

/** Exactly what /api/mcp/probe returns. Single shape (the project runs with
 *  strict:false, where discriminated-union narrowing is unreliable). */
export interface ProbeResult {
  reachable: boolean;
  status?: number;
  latency_ms?: number;
  error?: string;
}

/** Probe an HTTP/SSE endpoint's reachability via the backend (honest — real network). */
export const probeServer = async (url: string): Promise<ProbeResult> => {
  const res = await fetch(`${getBackendUrl()}/api/mcp/probe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`probe failed (${res.status})`);
  return res.json();
};
