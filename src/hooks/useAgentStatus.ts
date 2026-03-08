import { useState, useEffect, useRef } from "react";
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

  // Subscribe to client-side status changes
  useEffect(() => {
    const unsub = subscribeAgentStatus((a, active, step) => {
      setAgents(a);
      setActiveAgent(active);
      setPipelineStep(step);
    });
    return unsub;
  }, []);

  // Poll local backend for status
  useEffect(() => {
    const mode = getBackendMode();
    if (mode !== "local") return;

    const poll = async () => {
      const res = await fetchAgentStatus();
      setAgents(res.agents);
      setActiveAgent(res.activeAgent || null);
    };

    poll();
    intervalRef.current = setInterval(poll, pollInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pollInterval]);

  return { agents, activeAgent, pipelineStep };
};
