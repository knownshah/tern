import { OpenAICompatibleProvider } from './openai-compatible.js';

export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      id: 'openrouter',
      name: 'OpenRouter',
      apiKeyEnv: 'OPENROUTER_API_KEY',
      baseUrlEnv: 'OPENROUTER_BASE_URL',
      modelEnv: 'OPENROUTER_MODEL',
      defaultBaseUrl: 'https://openrouter.ai/api/v1',
      defaultModel: 'meta-llama/llama-3.3-70b-instruct',
    });
  }
}
