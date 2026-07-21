import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, Terminal } from "lucide-react";

const AuthCallback = () => {
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const exchange = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (!code) {
        setError("No authorization code returned. Please try signing in again.");
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setError(error.message || "Authentication failed. Please try again.");
      } else {
        navigate("/", { replace: true });
      }
    };
    exchange();
  }, [navigate]);

  return (
    <main className="h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Terminal className="w-8 h-8 text-primary" />
          <h1 className="font-display text-2xl text-primary tracking-wider">ECHO</h1>
        </div>
        {error ? (
          <p className="text-xs text-destructive font-mono border border-destructive/30 bg-destructive/10 rounded px-4 py-3 max-w-sm">
            {error}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Completing sign-in...
          </div>
        )}
      </div>
    </main>
  );
};

export default AuthCallback;
