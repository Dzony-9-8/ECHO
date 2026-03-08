import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Terminal, KeyRound, Loader2, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      // Supabase will automatically set the session from the hash
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-background flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 scanline pointer-events-none" />
      <div className="w-full max-w-sm mx-4 relative z-10">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Terminal className="w-8 h-8 text-primary glow-green" />
            <h1 className="font-display text-2xl text-primary glow-green tracking-wider">ECHO</h1>
          </div>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
            Set New Password
          </p>
        </div>

        {success ? (
          <div className="border border-primary bg-primary/10 rounded p-6 text-center">
            <CheckCircle className="w-8 h-8 text-primary mx-auto mb-3" />
            <p className="text-sm text-primary font-mono">Password updated successfully</p>
            <p className="text-xs text-muted-foreground font-mono mt-1">Redirecting...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="border border-border bg-card rounded p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="w-4 h-4 text-primary" />
              <span className="text-xs text-primary font-mono uppercase tracking-wider">Reset Password</span>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:glow-border font-mono"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:glow-border font-mono"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-xs text-terminal-red font-mono border border-terminal-red/30 bg-terminal-red/10 rounded px-3 py-2">
                ⚠ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-mono uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
