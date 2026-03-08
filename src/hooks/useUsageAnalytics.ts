import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UsageLog {
  id: string;
  model: string;
  tokens_estimated: number;
  latency_ms: number | null;
  created_at: string;
}

export interface UsageStats {
  totalTokens: number;
  totalRequests: number;
  avgLatency: number;
  modelBreakdown: Record<string, { count: number; tokens: number }>;
  dailyUsage: { date: string; tokens: number; requests: number }[];
}

export const useUsageAnalytics = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("usage_logs")
      .select("*")
      .order("created_at", { ascending: true });

    if (!data) { setLoading(false); return; }

    const totalTokens = data.reduce((s, l) => s + (l.tokens_estimated || 0), 0);
    const totalRequests = data.length;
    const latencies = data.filter((l) => l.latency_ms).map((l) => l.latency_ms!);
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

    const modelBreakdown: Record<string, { count: number; tokens: number }> = {};
    const dailyMap: Record<string, { tokens: number; requests: number }> = {};

    for (const log of data) {
      // Model breakdown
      if (!modelBreakdown[log.model]) modelBreakdown[log.model] = { count: 0, tokens: 0 };
      modelBreakdown[log.model].count++;
      modelBreakdown[log.model].tokens += log.tokens_estimated || 0;

      // Daily
      const day = log.created_at.slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { tokens: 0, requests: 0 };
      dailyMap[day].tokens += log.tokens_estimated || 0;
      dailyMap[day].requests++;
    }

    const dailyUsage = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }));

    setStats({ totalTokens, totalRequests, avgLatency, modelBreakdown, dailyUsage });
    setLoading(false);
  }, [user]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const logUsage = useCallback(async (model: string, tokensEstimated: number, latencyMs?: number, conversationId?: string) => {
    if (!user) return;
    await supabase.from("usage_logs").insert({
      user_id: user.id,
      model,
      tokens_estimated: tokensEstimated,
      latency_ms: latencyMs || null,
      conversation_id: conversationId || null,
    });
    loadStats();
  }, [user, loadStats]);

  return { stats, loading, logUsage, refresh: loadStats };
};
