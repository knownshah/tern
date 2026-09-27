import type { AIProvider, DiagnosticPayload } from './types.js';

export class OpenAICompatibleProvider implements AIProvider {
  id = 'openai';
  name = 'OpenAI-Compatible';

  constructor(
    private options?: {
      apiKeyEnv?: string;
      baseUrlEnv?: string;
      modelEnv?: string;
      defaultBaseUrl?: string;
      defaultModel?: string;
      id?: string;
      name?: string;
    }
  ) {
    if (options?.id) this.id = options.id;
    if (options?.name) this.name = options.name;
  }

  private getApiKey(): string | undefined {
    const envKey = this.options?.apiKeyEnv || 'OPENAI_API_KEY';
    return process.env[envKey];
  }

  private getBaseUrl(): string {
    const envBase = this.options?.baseUrlEnv ? process.env[this.options.baseUrlEnv] : undefined;
    return envBase || this.options?.defaultBaseUrl || 'https://api.openai.com/v1';
  }

  private getModel(): string {
    const envModel = this.options?.modelEnv ? process.env[this.options.modelEnv] : undefined;
    return envModel || this.options?.defaultModel || 'gpt-4o-mini';
  }

  isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  getMissingConfigInstructions(): string {
    const keyName = this.options?.apiKeyEnv || 'OPENAI_API_KEY';
    return `To use ${this.name}, set the ${keyName} environment variable:\n  export ${keyName}='your-api-key'`;
  }

  async explainIssues(payload: DiagnosticPayload): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(this.getMissingConfigInstructions());
    }

    const systemPrompt =
      'You are Tern, an intelligent developer environment doctor. Analyze the following sanitized project diagnostic report and provide a concise, friendly, step-by-step remediation guide. Highlight why each issue occurred and the exact CLI commands to fix it. Do not recommend disclosing secrets.';

    const userPrompt = `Here is the sanitized diagnostic report from Tern:\n\n${JSON.stringify(payload, null, 2)}\n\nPlease provide your diagnosis and remediation steps.`;

    return this.callChatCompletion(systemPrompt, userPrompt);
  }

  async explainError(errorMessage: string): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(this.getMissingConfigInstructions());
    }

    const systemPrompt =
      'You are Tern, an expert developer environment doctor. Explain this developer error clearly: what it means, why it happened, and how to fix it with exact terminal commands.';

    return this.callChatCompletion(systemPrompt, errorMessage);
  }

  private async callChatCompletion(systemPrompt: string, userPrompt: string): Promise<string> {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl().replace(/\/+$/, '');
    const model = this.getModel();

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `${this.name} API request failed (${response.status} ${response.statusText}): ${errorText}`
      );
    }

    const data = (await response.json()) as any;
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`Empty response from ${this.name} API.`);
    }

    return content.trim();
  }
}
