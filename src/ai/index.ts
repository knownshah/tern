import { getProvider } from './provider.js';

export * from './types.js';
export * from './sanitize.js';
export * from './provider.js';
export * from './deepseek.js';
export * from './openai-compatible.js';
export * from './openrouter.js';
export * from './ollama.js';

export async function explainErrorWithAI(
  errorMessage: string,
  options?: { provider?: string }
): Promise<string> {
  const provider = getProvider(options?.provider);
  return provider.explainError(errorMessage);
}
