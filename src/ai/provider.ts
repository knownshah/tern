import type { AIProvider } from './types.js';
import { DeepSeekProvider } from './deepseek.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';
import { OpenRouterProvider } from './openrouter.js';
import { OllamaProvider } from './ollama.js';

export function getAvailableProviders(): AIProvider[] {
  return [
    new DeepSeekProvider(),
    new OpenAICompatibleProvider(),
    new OpenRouterProvider(),
    new OllamaProvider(),
  ];
}

export function getProvider(name?: string): AIProvider {
  const providers = getAvailableProviders();

  if (name) {
    const cleanName = name.toLowerCase().trim();
    const matched = providers.find((p) => p.id === cleanName || p.name.toLowerCase().includes(cleanName));
    if (!matched) {
      const validNames = providers.map((p) => p.id).join(', ');
      throw new Error(`Unknown AI provider "${name}". Supported providers: ${validNames}`);
    }
    return matched;
  }

  // Auto-selection based on configured environment variables
  if (process.env.DEEPSEEK_API_KEY) {
    return new DeepSeekProvider();
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAICompatibleProvider();
  }
  if (process.env.OPENROUTER_API_KEY) {
    return new OpenRouterProvider();
  }
  if (process.env.OLLAMA_HOST) {
    return new OllamaProvider();
  }

  // Fallback to DeepSeek or OpenAI with clear instructions if none configured
  const deepseek = new DeepSeekProvider();
  return deepseek;
}
