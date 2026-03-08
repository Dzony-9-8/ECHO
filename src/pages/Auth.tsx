import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Terminal, LogIn, UserPlus, Loader2, KeyRound } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split("@")[0] },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setMessage("Check your email to confirm your account.");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Scanline overlay */}
      <div className="absolute inset-0 scanline pointer-events-none" />

      <div className="w-full max-w-sm mx-4 relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Terminal className="w-8 h-8 text-primary glow-green" />
            <h1 className="font-display text-2xl text-primary glow-green tracking-wider">
              ECHO
            </h1>
          </div>
          <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
            Multi-Agent AI Orchestration
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="border border-border bg-card rounded p-6 space-y-4"
        >
          <div className="flex gap-1 mb-4">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(""); setMessage(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs font-mono border transition-all ${
                isLogin
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Login
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(""); setMessage(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded text-xs font-mono border transition-all ${
                !isLogin
                  ? "border-terminal-cyan text-terminal-cyan bg-terminal-cyan/10"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Sign Up
            </button>
          </div>

          {!isLogin && (
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:glow-border font-mono"
                placeholder="operator_name"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:glow-border font-mono"
              placeholder="operator@echo.sys"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">
              Password
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

          {error && (
            <div className="text-xs text-terminal-red font-mono border border-terminal-red/30 bg-terminal-red/10 rounded px-3 py-2">
              ⚠ {error}
            </div>
          )}

          {message && (
            <div className="text-xs text-primary font-mono border border-primary/30 bg-primary/10 rounded px-3 py-2">
              ✓ {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-sm font-mono uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {isLogin ? "Authenticate" : "Register"}
              </>
            )}
          </button>
        </form>

        <p className="text-[9px] text-muted-foreground text-center mt-4 font-mono uppercase tracking-wider">
          ECHO AI System v2.0 · Secure Access
        </p>
      </div>
    </div>
  );
};

export default Auth;
