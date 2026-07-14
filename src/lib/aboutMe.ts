// Personal "About me" context — a user profile injected into the assistant's
// system prompt so every response is personalized. Local-only (echo_about_me).

export interface AboutMe {
  enabled: boolean;
  name: string;
  role: string;          // job / what they do
  about: string;         // free-form background
  preferences: string;   // interests, tone likes/dislikes
  instructions: string;  // how the assistant should respond
}

const KEY = "echo_about_me";

export const EMPTY_ABOUT: AboutMe = {
  enabled: true,
  name: "",
  role: "",
  about: "",
  preferences: "",
  instructions: "",
};

export const loadAboutMe = (): AboutMe => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_ABOUT;
    return { ...EMPTY_ABOUT, ...JSON.parse(raw) };
  } catch {
    return EMPTY_ABOUT;
  }
};

export const saveAboutMe = (p: AboutMe) => localStorage.setItem(KEY, JSON.stringify(p));

/** True when the profile has at least one non-empty content field. */
export const hasContent = (p: AboutMe): boolean =>
  !!(p.name.trim() || p.role.trim() || p.about.trim() || p.preferences.trim() || p.instructions.trim());

/**
 * Render the profile as a system-prompt block. Returns "" when disabled or empty
 * so nothing is injected (and no fabricated persona is implied).
 */
export const buildProfilePrompt = (p: AboutMe = loadAboutMe()): string => {
  if (!p.enabled || !hasContent(p)) return "";
  const lines: string[] = [
    "About the user you are assisting (use this to personalize responses; do not repeat it back verbatim):",
  ];
  if (p.name.trim()) lines.push(`- Name: ${p.name.trim()}`);
  if (p.role.trim()) lines.push(`- Role: ${p.role.trim()}`);
  if (p.about.trim()) lines.push(`- Background: ${p.about.trim()}`);
  if (p.preferences.trim()) lines.push(`- Preferences: ${p.preferences.trim()}`);
  if (p.instructions.trim()) lines.push(`- How to respond: ${p.instructions.trim()}`);
  return lines.join("\n");
};
