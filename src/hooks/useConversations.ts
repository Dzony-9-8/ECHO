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

export const useConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("echo_pinned_conversations");
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Persist pinned IDs
  useEffect(() => {
    localStorage.setItem("echo_pinned_conversations", JSON.stringify([...pinnedIds]));
  }, [pinnedIds]);

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setConversations(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Create new conversation
  const createConversation = useCallback(async (title?: string): Promise<string | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: title || "New Conversation" })
      .select()
      .single();
    if (error || !data) return null;
    setConversations((prev) => [data, ...prev]);
    setActiveConversationId(data.id);
    return data.id;
  }, [user]);

  // Delete conversation
  const deleteConversation = useCallback(async (id: string) => {
    await supabase.from("conversations").delete().eq("id", id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setPinnedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (activeConversationId === id) setActiveConversationId(null);
  }, [activeConversationId]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (conversationId: string): Promise<ChatMessage[]> => {
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
  }, []);

  // Save a message
  const saveMessage = useCallback(async (
    conversationId: string,
    msg: { role: string; content: string; agent?: string; model?: string }
  ) => {
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
  }, [loadConversations]);

  // Search messages across all conversations
  const searchMessages = useCallback(async (query: string): Promise<Array<{
    conversationId: string;
    conversationTitle: string;
    messageContent: string;
    messageRole: string;
    messageAgent?: string;
    createdAt: string;
  }>> => {
    if (!user || !query.trim()) return [];
    const { data } = await supabase
      .from("messages")
      .select("id, content, role, agent, created_at, conversation_id")
      .ilike("content", `%${query}%`)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!data) return [];
    
    // Map conversation IDs to titles
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
  }, [user, conversations]);

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
