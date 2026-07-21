import { useState } from "react";
import { UserCircle, Save, Check, Eye, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { type AboutMe, loadAboutMe, saveAboutMe, buildProfilePrompt, hasContent } from "@/lib/aboutMe";

interface Field {
  key: keyof Omit<AboutMe, "enabled">;
  label: string;
  placeholder: string;
  rows: number;
  hint?: string;
}

const FIELDS: Field[] = [
  { key: "name", label: "Name / what to call you", placeholder: "e.g. Nikola", rows: 1 },
  { key: "role", label: "Role / what you do", placeholder: "e.g. Full-stack developer building an AI workspace", rows: 2 },
  { key: "about", label: "Background", placeholder: "Anything the assistant should know about you or your projects…", rows: 3 },
  { key: "preferences", label: "Preferences", placeholder: "Interests, tools you like, topics to favor or avoid…", rows: 3 },
  { key: "instructions", label: "How the assistant should respond", placeholder: "e.g. Be concise and direct. Prefer code examples. Skip disclaimers.", rows: 3 },
];

const AboutMeView = () => {
  const [profile, setProfile] = useState<AboutMe>(() => loadAboutMe());
  const [saved, setSaved] = useState(false);

  const update = (key: keyof AboutMe, value: string | boolean) => {
    setProfile((p) => ({ ...p, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    saveAboutMe(profile);
    setSaved(true);
    toast.success("Profile saved — it will personalize new responses.");
    setTimeout(() => setSaved(false), 2000);
  };

  const preview = buildProfilePrompt(profile);
  const active = profile.enabled && hasContent(profile);

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <UserCircle className="w-5 h-5 text-terminal-cyan" style={{ filter: "drop-shadow(0 0 6px hsl(185 60% 50% / 0.6))" }} />
          <div>
            <h1 className="text-lg font-display tracking-wider text-foreground">About Me</h1>
            <p className="text-[10px] font-mono text-muted-foreground">
              Personal context added to every chat so responses fit you
            </p>
          </div>
        </div>
        {/* Enable toggle */}
        <button
          onClick={() => update("enabled", !profile.enabled)}
          className={`flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 rounded border transition-all ${
            profile.enabled
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {profile.enabled ? "Personalization ON" : "Personalization OFF"}
        </button>
      </div>

      {/* Fields */}
      <div className="space-y-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">{f.label}</label>
            {f.rows === 1 ? (
              <input
                value={profile[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full mt-1 bg-input border border-border rounded px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary"
              />
            ) : (
              <textarea
                value={profile[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                placeholder={f.placeholder}
                rows={f.rows}
                className="w-full mt-1 bg-input border border-border rounded px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary resize-none"
              />
            )}
          </div>
        ))}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={save}
          className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest px-4 py-2 rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          {saved ? "Saved" : "Save profile"}
        </button>
        <span className="text-[10px] font-mono text-muted-foreground">
          {active ? "Injected into new chat messages." : profile.enabled ? "Add some detail to activate." : "Turned off — nothing is injected."}
        </span>
      </div>

      {/* Live preview of the exact injected text (honest — no hidden magic) */}
      <div className="mt-6">
        <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-2">
          <Eye className="w-3 h-3" /> Exactly what the assistant receives
        </div>
        <pre className={`text-[11px] font-mono whitespace-pre-wrap break-words rounded-lg border p-3 ${
          active ? "border-terminal-cyan/30 bg-terminal-cyan/5 text-foreground" : "border-border bg-muted/20 text-muted-foreground/50"
        }`}>
          {preview || "— nothing (personalization off or empty) —"}
        </pre>
      </div>

      <p className="text-[9px] font-mono text-muted-foreground/50 mt-4 text-center">
        Stored only in this browser (echo_about_me). It's prepended to the system prompt of new messages; it never overrides a per-conversation system prompt.
      </p>
    </div>
  );
};

export default AboutMeView;
