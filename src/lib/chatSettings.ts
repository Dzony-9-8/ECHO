// Chat settings stored in localStorage

export interface ChatSettings {
  temperature: number;       // 0.0 - 2.0
  maxTokens: number;         // 256 - 8192
  responseFormat: "auto" | "markdown" | "plaintext" | "code";
  systemBehavior: string;    // e.g. "concise", "detailed", "technical"
}

const STORAGE_KEY = "echo_chat_settings";

const DEFAULTS: ChatSettings = {
  temperature: 0.7,
  maxTokens: 2048,
  responseFormat: "auto",
  systemBehavior: "balanced",
};

export const getChatSettings = (): ChatSettings => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
};

export const saveChatSettings = (settings: ChatSettings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const TEMPERATURE_PRESETS = [
  { value: 0, label: "Precise", desc: "Deterministic, factual" },
  { value: 0.3, label: "Focused", desc: "Low creativity" },
  { value: 0.7, label: "Balanced", desc: "Default" },
  { value: 1.0, label: "Creative", desc: "Higher variety" },
  { value: 1.5, label: "Wild", desc: "Experimental" },
] as const;

export const RESPONSE_FORMATS = [
  { value: "auto", label: "Auto", desc: "AI decides format" },
  { value: "markdown", label: "Markdown", desc: "Rich formatting" },
  { value: "plaintext", label: "Plain Text", desc: "No formatting" },
  { value: "code", label: "Code", desc: "Code-focused output" },
] as const;

export const BEHAVIOR_PRESETS = [
  { value: "concise", label: "Concise", desc: "Brief, to-the-point" },
  { value: "balanced", label: "Balanced", desc: "Default verbosity" },
  { value: "detailed", label: "Detailed", desc: "Thorough explanations" },
  { value: "technical", label: "Technical", desc: "Expert-level depth" },
] as const;
