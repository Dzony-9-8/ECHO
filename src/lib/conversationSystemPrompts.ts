const STORAGE_KEY = "echo_per_conv_system_prompts";

export const getPerConvPrompts = (): Record<string, string> => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

export const getConversationSystemPrompt = (conversationId: string): string => {
  return getPerConvPrompts()[conversationId] || "";
};

export const setConversationSystemPrompt = (conversationId: string, prompt: string) => {
  const prompts = getPerConvPrompts();
  if (prompt.trim()) {
    prompts[conversationId] = prompt;
  } else {
    delete prompts[conversationId];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
};
