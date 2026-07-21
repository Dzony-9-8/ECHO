// Presets — reusable chat configuration bundles (model + system prompt + depth).
// Applying a preset writes the same localStorage keys the chat already reads
// (echo_selected_model, echo_system_prompt, echo_depth), so ChatView/ChatInput
// pick them up when the Chat view next mounts.

export interface Preset {
  id: string;
  name: string;
  model: string;        // empty = keep the currently-selected model
  systemPrompt: string;
  depth: number;        // critic-iteration depth (1–3)
}

const PRESETS_KEY = "echo_presets";
const SEEDED_KEY = "echo_presets_seeded";

export const MODEL_STORAGE_KEY = "echo_selected_model";
export const SYSTEM_PROMPT_KEY = "echo_system_prompt";
export const DEPTH_KEY = "echo_depth";

const DEFAULT_PRESETS: Preset[] = [
  {
    id: "preset-coder",
    name: "Coder",
    model: "",
    systemPrompt:
      "You are a senior software engineer. Write correct, idiomatic, production-ready code. Prefer clarity over cleverness, explain trade-offs briefly, and point out edge cases.",
    depth: 1,
  },
  {
    id: "preset-deep-reasoner",
    name: "Deep Reasoner",
    model: "",
    systemPrompt:
      "Think step by step. Break the problem into parts, weigh alternatives, and verify your conclusion before answering. Show the key reasoning, not just the result.",
    depth: 3,
  },
  {
    id: "preset-concise",
    name: "Concise",
    model: "",
    systemPrompt:
      "Answer as directly and briefly as possible. No preamble, no filler. Use bullet points when listing. Only expand when explicitly asked.",
    depth: 1,
  },
];

export const loadPresets = (): Preset[] => {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (raw === null && localStorage.getItem(SEEDED_KEY) !== "true") {
      // First run — seed the starter presets once (deleting them all later sticks).
      localStorage.setItem(PRESETS_KEY, JSON.stringify(DEFAULT_PRESETS));
      localStorage.setItem(SEEDED_KEY, "true");
      return [...DEFAULT_PRESETS];
    }
    return JSON.parse(raw || "[]");
  } catch {
    return [];
  }
};

export const savePresets = (presets: Preset[]) => {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  localStorage.setItem(SEEDED_KEY, "true");
};

export const upsertPreset = (preset: Preset): Preset[] => {
  const presets = loadPresets();
  const idx = presets.findIndex((p) => p.id === preset.id);
  if (idx >= 0) presets[idx] = preset;
  else presets.push(preset);
  savePresets(presets);
  return presets;
};

export const deletePreset = (id: string): Preset[] => {
  const presets = loadPresets().filter((p) => p.id !== id);
  savePresets(presets);
  return presets;
};

/** Applies a preset by writing the chat-config localStorage keys. */
export const applyPreset = (preset: Preset) => {
  if (preset.model) localStorage.setItem(MODEL_STORAGE_KEY, preset.model);
  localStorage.setItem(SYSTEM_PROMPT_KEY, preset.systemPrompt ?? "");
  localStorage.setItem(DEPTH_KEY, String(preset.depth ?? 1));
  // Let any live listeners react immediately (ChatView also re-reads on mount).
  window.dispatchEvent(new CustomEvent("echo:preset-applied", { detail: preset }));
};
