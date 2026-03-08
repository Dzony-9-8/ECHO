import { useState } from "react";
import { Link2, Copy, Check, X, Link2Off } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  conversationId: string | null;
  open: boolean;
  onClose: () => void;
}

const ShareDialog = ({ conversationId, open, onClose }: Props) => {
  const { user } = useAuth();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!open || !conversationId) return null;

  const handleShare = async () => {
    if (!user) return;
    setLoading(true);

    // Check if already shared
    const { data: existing } = await supabase
      .from("shared_conversations")
      .select("share_token, is_active")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (existing?.is_active) {
      const url = `${window.location.origin}/shared?token=${existing.share_token}`;
      setShareUrl(url);
      setLoading(false);
      return;
    }

    // Create new share
    const { data, error } = await supabase
      .from("shared_conversations")
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
      })
      .select("share_token")
      .single();

    if (error || !data) {
      toast.error("Failed to create share link");
      setLoading(false);
      return;
    }

    const url = `${window.location.origin}/shared?token=${data.share_token}`;
    setShareUrl(url);
    setLoading(false);
    toast.success("Share link created");
  };

  const handleRevoke = async () => {
    if (!user) return;
    await supabase
      .from("shared_conversations")
      .update({ is_active: false })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
    setShareUrl(null);
    toast.success("Share link revoked");
  };

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-background/80 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-mono text-primary uppercase tracking-wider flex items-center gap-2">
              <Link2 className="w-4 h-4" /> Share Conversation
            </h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {!shareUrl ? (
              <div className="text-center space-y-3">
                <p className="text-[11px] font-mono text-muted-foreground">
                  Create a public read-only link to share this conversation.
                </p>
                <button
                  onClick={handleShare}
                  disabled={loading}
                  className="w-full px-4 py-2 rounded border border-primary text-primary font-mono text-[11px] hover:bg-primary/10 transition-colors disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Generate Share Link"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-1">
                  <input
                    value={shareUrl}
                    readOnly
                    className="flex-1 bg-input border border-border rounded px-2 py-1.5 text-[10px] font-mono text-foreground focus:outline-none"
                  />
                  <button onClick={handleCopy} className="px-2 rounded border border-primary text-primary hover:bg-primary/10 transition-colors">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button
                  onClick={handleRevoke}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded border border-terminal-red text-terminal-red font-mono text-[10px] hover:bg-terminal-red/10 transition-colors"
                >
                  <Link2Off className="w-3 h-3" /> Revoke Share Link
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ShareDialog;
