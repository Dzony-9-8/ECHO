// Simple token estimation (≈4 chars per token for English text)
export const estimateTokens = (text: string): number => {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
};

export const formatTokenCount = (count: number): string => {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
};
