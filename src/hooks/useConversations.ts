import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { ChatMessage } from "@/lib/api";

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const LOCAL_CONVS_KEY = "echo_local_conversations";
const localMsgKey = (id: string) => `echo_local_msgs_${id}`;

const getLocalConversations = (): Conversation[] => {
  try { return JSON.parse(localStorage.getItem(LOCAL_CONVS_KEY) || "[]"); }
  catch { return []; }
};

const setLocalConversations = (convs: Conversation[]) => {
  localStorage.setItem(LOCAL_CONVS_KEY, JSON.stringify(convs));
};

const getLocalMessages = (convId: string): ChatMessage[] => {
  try { return JSON.parse(localStorage.getItem(localMsgKey(convId)) || "[]"); }
  catch { return []; }
};

const setLocalMessages = (convId: string, msgs: ChatMessage[]) => {
  localStorage.setItem(localMsgKey(convId), JSON.stringify(msgs));
};

export const useConversations = () => {
  const { user } = useAuth();
  const isLocal = user?.id === "local";

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("echo_pinned_conversations");
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  useEffect(() => {
    localStorage.setItem("echo_pinned_conversations", JSON.stringify([...pinnedIds]));
  }, [pinnedIds]);

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    if (isLocal) {
      setConversations(getLocalConversations());
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setConversations(data);
    setLoading(false);
  }, [user, isLocal]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const createConversation = useCallback(async (title?: string): Promise<string | null> => {
    if (!user) return null;
    if (isLocal) {
      const conv: Conversation = {
        id: crypto.randomUUID(),
        title: title || "New Conversation",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const updated = [conv, ...getLocalConversations()];
      setLocalConversations(updated);
      setConversations(updated);
      setActiveConversationId(conv.id);
      return conv.id;
    }
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: title || "New Conversation" })
      .select().single();
    if (error || !data) return null;
    setConversations((prev) => [data, ...prev]);
    setActiveConversationId(data.id);
    return data.id;
  }, [user, isLocal]);

  const deleteConversation = useCallback(async (id: string) => {
    if (isLocal) {
      const updated = getLocalConversations().filter((c) => c.id !== id);
      setLocalConversations(updated);
      setConversations(updated);
      localStorage.removeItem(localMsgKey(id));
    } else {
      await supabase.from("conversations").delete().eq("id", id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
    }
    setPinnedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    if (activeConversationId === id) setActiveConversationId(null);
  }, [activeConversationId, isLocal]);

  const loadMessages = useCallback(async (conversationId: string): Promise<ChatMessage[]> => {
    if (isLocal) return getLocalMessages(conversationId);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (!data) return [];
    return data.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      timestamp: new Date(m.created_at),
      agent: m.agent || undefined,
      model: m.model || undefined,
      status: "complete" as const,
    }));
  }, [isLocal]);

  const saveMessage = useCallback(async (
    conversationId: string,
    msg: { role: string; content: string; agent?: string; model?: string }
  ) => {
    if (isLocal) {
      const existing = getLocalMessages(conversationId);
      const newMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
        timestamp: new Date(),
        agent: msg.agent,
        model: msg.model,
        status: "complete",
      };
      setLocalMessages(conversationId, [...existing, newMsg]);
      // Update conversation title from first user message
      if (msg.role === "user" && msg.content.length > 0) {
        const convs = getLocalConversations().map((c) =>
          c.id === conversationId
            ? { ...c, title: msg.content.slice(0, 80), updated_at: new Date().toISOString() }
            : c
        );
        setLocalConversations(convs);
        setConversations(convs);
      }
      return;
    }
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: msg.role,
      content: msg.content,
      agent: msg.agent || null,
      model: msg.model || null,
    });
    const updates: Record<string, string> = { updated_at: new Date().toISOString() };
    if (msg.role === "user" && msg.content.length > 0) {
      updates.title = msg.content.slice(0, 80);
    }
    await supabase.from("conversations").update(updates).eq("id", conversationId);
    loadConversations();
  }, [isLocal, loadConversations]);

  const searchMessages = useCallback(async (query: string): Promise<Array<{
    conversationId: string;
    conversationTitle: string;
    messageContent: string;
    messageRole: string;
    messageAgent?: string;
    createdAt: string;
  }>> => {
    if (!user || !query.trim()) return [];
    if (isLocal) {
      const convs = getLocalConversations();
      const results: Array<{
        conversationId: string;
        conversationTitle: string;
        messageContent: string;
        messageRole: string;
        messageAgent?: string;
        createdAt: string;
      }> = [];
      for (const conv of convs) {
        const msgs = getLocalMessages(conv.id);
        for (const m of msgs) {
          if (m.content.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              conversationId: conv.id,
              conversationTitle: conv.title,
              messageContent: m.content,
              messageRole: m.role,
              messageAgent: m.agent,
              createdAt: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
            });
          }
        }
      }
      return results;
    }
    const { data } = await supabase
      .from("messages")
      .select("id, content, role, agent, created_at, conversation_id")
      .ilike("content", `%${query}%`)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!data) return [];
    const convMap = new Map(conversations.map(c => [c.id, c.title]));
    return data
      .filter(m => convMap.has(m.conversation_id))
      .map(m => ({
        conversationId: m.conversation_id,
        conversationTitle: convMap.get(m.conversation_id) || "Unknown",
        messageContent: m.content,
        messageRole: m.role,
        messageAgent: m.agent || undefined,
        createdAt: m.created_at,
      }));
  }, [user, isLocal, conversations]);

  return {
    conversations,
    activeConversationId,
    setActiveConversationId,
    createConversation,
    deleteConversation,
    loadMessages,
    saveMessage,
    loading,
    pinnedIds,
    togglePin,
    searchMessages,
  };
};
