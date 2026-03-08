import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type ChatMessage as ChatMessageType } from "@/lib/api";
import ChatMessageComponent from "@/components/ChatMessage";
import { Link2Off, Terminal } from "lucide-react";

const SharedView = () => {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      if (!token) { setError("No share token provided"); setLoading(false); return; }

      // Get shared conversation
      const { data: shared } = await supabase
        .from("shared_conversations")
        .select("conversation_id, is_active")
        .eq("share_token", token)
        .single();

      if (!shared || !shared.is_active) {
        setError("This shared link is no longer active");
        setLoading(false);
        return;
      }

      // Get conversation title
      const { data: conv } = await supabase
        .from("conversations")
        .select("title")
        .eq("id", shared.conversation_id)
        .single();

      if (conv) setTitle(conv.title);

      // Get messages
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", shared.conversation_id)
        .order("created_at", { ascending: true });

      if (msgs) {
        setMessages(
          msgs.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            timestamp: new Date(m.created_at),
            agent: m.agent || undefined,
            model: m.model || undefined,
            status: "complete" as const,
          }))
        );
      }
      setLoading(false);
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary glow-green font-mono text-sm animate-pulse">Loading shared conversation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Link2Off className="w-8 h-8 text-terminal-red mx-auto" />
          <p className="text-sm font-mono text-terminal-red">{error}</p>
          <a href="/" className="text-[10px] font-mono text-primary hover:underline">Go to ECHO →</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <Terminal className="w-5 h-5 text-primary glow-green" />
        <span className="font-display text-sm text-primary glow-green tracking-wider">ECHO</span>
        <span className="text-border">|</span>
        <span className="text-xs font-mono text-foreground truncate">{title}</span>
        <div className="flex-1" />
        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider px-2 py-1 rounded border border-border">
          Read-only
        </span>
      </div>

      {/* Messages */}
      <div className="max-w-4xl mx-auto py-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm font-mono text-muted-foreground py-8">No messages in this conversation</p>
        ) : (
          messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-card px-4 py-2 text-center">
        <a href="/" className="text-[10px] font-mono text-primary hover:underline">
          Powered by ECHO AI System
        </a>
      </div>
    </div>
  );
};

export default SharedView;
