// Token estimation utilities
// Approximate token counts for different providers and models

export function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English, ~2 chars for Chinese
  const englishChars = (text.match(/[a-zA-Z0-9\s]/g) || []).length;
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - englishChars - chineseChars;

  return Math.ceil(englishChars / 4 + chineseChars / 2 + otherChars / 3);
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(0)}K`;
  }
  return tokens.toString();
}

export const LLM_PROVIDERS = {
  anthropic: {
    name: "Anthropic",
    models: [
      "claude-opus-4-8",
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
    ],
    defaultModel: "claude-sonnet-4-6",
    color: "#d97757",
  },
  openai: {
    name: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini", "o4-mini"],
    defaultModel: "gpt-4o",
    color: "#74aa9c",
  },
  deepseek: {
    name: "DeepSeek",
    models: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
    color: "#4d6bfe",
  },
  qwen: {
    name: "Qwen",
    models: ["qwen-max", "qwen-plus", "qwen-turbo"],
    defaultModel: "qwen-plus",
    color: "#615ced",
  },
} as const;

export type LLMProvider = keyof typeof LLM_PROVIDERS;

