import type { AIProvider, DiagnosticPayload } from './types.js';

export class OllamaProvider implements AIProvider {
  id = 'ollama';
  name = 'Ollama (Local)';

  private getHost(): string {
    return process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  }

  private getModel(): string {
    return process.env.OLLAMA_MODEL || 'llama3.2';
  }

  isConfigured(): boolean {
    // Local Ollama doesn't require an API key by default
    return true;
  }

  getMissingConfigInstructions(): string {
    const host = this.getHost();
    return `To use Ollama, verify that Ollama is installed and running locally:\n  ollama run ${this.getModel()}\nOr specify a custom host with OLLAMA_HOST (current: ${host})`;
  }

  async explainIssues(payload: DiagnosticPayload): Promise<string> {
    const systemPrompt =
      'You are Tern, an intelligent developer environment doctor. Analyze the following sanitized project diagnostic report and provide a concise, friendly, step-by-step remediation guide. Highlight why each issue occurred and the exact CLI commands to fix it. Do not recommend disclosing secrets.';

    const userPrompt = `Here is the sanitized diagnostic report from Tern:\n\n${JSON.stringify(payload, null, 2)}\n\nPlease provide your diagnosis and remediation steps.`;

    return this.callOllama(systemPrompt, userPrompt);
  }

  async explainError(errorMessage: string): Promise<string> {
    const systemPrompt =
      'You are Tern, an expert developer environment doctor. Explain this developer error clearly: what it means, why it happened, and how to fix it with exact terminal commands.';

    return this.callOllama(systemPrompt, errorMessage);
  }

  private async callOllama(systemPrompt: string, userPrompt: string): Promise<string> {
    const host = this.getHost().replace(/\/+$/, '');
    const model = this.getModel();

    try {
      const response = await fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Ollama chat failed (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as any;
      const content = data?.message?.content;
      if (!content) {
        throw new Error('Empty response from Ollama.');
      }

      return content.trim();
    } catch (err: any) {
      if (err.code === 'ECONNREFUSED' || err.message?.includes('fetch failed')) {
        throw new Error(
          `Cannot connect to Ollama at ${host}.\nEnsure Ollama is running with: ollama serve\nOr set OLLAMA_HOST to your remote Ollama endpoint.`,
          { cause: err }
        );
      }
      throw err;
    }
  }
}
