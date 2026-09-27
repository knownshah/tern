import { OpenAICompatibleProvider } from './openai-compatible.js';

export class DeepSeekProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      id: 'deepseek',
      name: 'DeepSeek',
      apiKeyEnv: 'DEEPSEEK_API_KEY',
      baseUrlEnv: 'DEEPSEEK_BASE_URL',
      modelEnv: 'DEEPSEEK_MODEL',
      defaultBaseUrl: 'https://api.deepseek.com',
      defaultModel: 'deepseek-chat',
    });
  }
}
