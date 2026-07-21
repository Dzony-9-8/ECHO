// Onboarding — a first-run guided tour of ECHO. Robust centered-carousel
// design (no fragile DOM-anchored tooltips). Persists a "seen" flag so it
// only auto-shows once; can be replayed from Settings.

export const ONBOARDED_KEY = "echo_onboarded";
export const TOUR_EVENT = "echo:start-tour";

export interface TourStep {
  /** lucide-react icon name resolved by the component. */
  icon: string;
  title: string;
  body: string;
  tip?: string;
}

export const isOnboarded = (): boolean => localStorage.getItem(ONBOARDED_KEY) === "1";

export const completeOnboarding = () => localStorage.setItem(ONBOARDED_KEY, "1");

/** Replay the tour (used by the Settings entry point). */
export const startOnboarding = () => window.dispatchEvent(new CustomEvent(TOUR_EVENT));

export const TOUR_STEPS: TourStep[] = [
  {
    icon: "Terminal",
    title: "Welcome to ECHO",
    body: "A local-first, multi-agent AI workspace with a terminal aesthetic. This 60-second tour points out where everything lives — you can replay it anytime from Themes → Settings.",
  },
  {
    icon: "MessageSquare",
    title: "Chat with the agent pipeline",
    body: "The Chat view routes your message through a planning → execution → critique pipeline. Attach files, dictate with the mic, insert emoji, and tune the critic depth per message.",
    tip: "Type “/” in the composer to browse slash commands, or “:” for emoji.",
  },
  {
    icon: "GitBranch",
    title: "Watch the agents work",
    body: "Workflow and Builder show the live agent pipeline and let you design your own. Telemetry and Diagnostics surface real system health — VRAM, cache, and service status.",
  },
  {
    icon: "SlidersHorizontal",
    title: "Make it yours",
    body: "Presets bundle model + prompt + depth. Themes ships 11 palettes plus font and scanline controls. Contacts, Notes, Documents, Calendar, Gallery and Reminders are all local to you.",
    tip: "Everything lives in the left sidebar — collapse it with the chevron at the bottom.",
  },
  {
    icon: "ShieldCheck",
    title: "Local & honest by design",
    body: "Your data stays in your browser and your backend. Features that need an external service (image generation, notifications) say so plainly and never fake results. Back everything up from Presets → Backup.",
  },
  {
    icon: "Rocket",
    title: "You're ready",
    body: "Head to Chat and ask ECHO anything. Explore the sidebar at your own pace — nothing here phones home.",
  },
];
