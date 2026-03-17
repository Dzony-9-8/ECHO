import { useState, useEffect, useRef, useCallback } from "react";
import {
  subscribeAgentStatus,
  fetchAgentStatus,
  type AgentStatus,
} from "@/lib/agentStatus";
import { getBackendMode } from "@/lib/api";

export const useAgentStatus = (pollInterval = 5000) => {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [pipelineStep, setPipelineStep] = useState(-1);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const activeRef = useRef<string | null>(null);

  // Subscribe to client-side status changes
  useEffect(() => {
    const unsub = subscribeAgentStatus((a, active, step) => {
      setAgents(a);
      setActiveAgent(active);
      setPipelineStep(step);
    });
    return unsub;
  }, []);

  // Adaptive polling: fast when an agent is active, slow when idle
  const scheduleNext = useCallback(() => {
    const interval = activeRef.current ? Math.min(pollInterval, 1500) : Math.max(pollInterval, 5000);
    intervalRef.current = setTimeout(async () => {
      const res = await fetchAgentStatus();
      activeRef.current = res.activeAgent || null;
      setAgents(res.agents);
      setActiveAgent(res.activeAgent || null);
      scheduleNext();
    }, interval);
  }, [pollInterval]);

  // Poll local backend for status
  useEffect(() => {
    const mode = getBackendMode();
    if (mode !== "local") return;

    // Initial fetch
    fetchAgentStatus().then((res) => {
      activeRef.current = res.activeAgent || null;
      setAgents(res.agents);
      setActiveAgent(res.activeAgent || null);
      scheduleNext();
    });

    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
    };
  }, [scheduleNext]);

  return { agents, activeAgent, pipelineStep };
};
