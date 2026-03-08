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
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMessage("Password reset link sent to your email.");
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) setError(error.message || "Google sign-in failed");
  };

  return (
    <main className="h-screen bg-background flex items-center justify-center relative overflow-hidden">
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

          {isLogin && (
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="w-full text-[10px] text-muted-foreground hover:text-primary font-mono uppercase tracking-wider transition-colors mt-1"
            >
              Forgot Password?
            </button>
          )}

          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[9px]">
              <span className="bg-card px-2 text-muted-foreground font-mono uppercase">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 rounded border border-border bg-muted/30 text-foreground hover:bg-muted/50 transition-colors text-sm font-mono flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </form>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
            <form onSubmit={handleForgotPassword} className="w-full max-w-sm mx-4 border border-border bg-card rounded p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="w-4 h-4 text-primary" />
                <span className="text-xs text-primary font-mono uppercase tracking-wider">Reset Password</span>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Email</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className="w-full bg-input border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:glow-border font-mono"
                  placeholder="operator@echo.sys"
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
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(false); setError(""); setMessage(""); }}
                  className="flex-1 py-2 rounded border border-border text-muted-foreground hover:text-foreground text-xs font-mono uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 text-xs font-mono uppercase disabled:opacity-50 flex items-center justify-center"
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Send Link"}
                </button>
              </div>
            </form>
          </div>
        )}

        <p className="text-[9px] text-muted-foreground text-center mt-4 font-mono uppercase tracking-wider">
          ECHO AI System v2.0 · Secure Access
        </p>
      </div>
    </main>
  );
};

export default Auth;
