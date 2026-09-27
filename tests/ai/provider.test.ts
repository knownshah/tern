import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getProvider, getAvailableProviders } from '../../src/ai/provider.js';
import { OpenAICompatibleProvider } from '../../src/ai/openai-compatible.js';
import { buildSanitizedDiagnosticPayload } from '../../src/ai/sanitize.js';
import type { CheckResult } from '../../src/types/index.js';

describe('ai/provider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('lists available providers', () => {
    const providers = getAvailableProviders();
    const ids = providers.map((p) => p.id);
    expect(ids).toContain('deepseek');
    expect(ids).toContain('openai');
    expect(ids).toContain('openrouter');
    expect(ids).toContain('ollama');
  });

  it('resolves requested provider by id', () => {
    const deepseek = getProvider('deepseek');
    expect(deepseek.id).toBe('deepseek');

    const ollama = getProvider('ollama');
    expect(ollama.id).toBe('ollama');
  });

  it('throws for unknown provider', () => {
    expect(() => getProvider('non-existent-ai')).toThrow(/Unknown AI provider/);
  });

  it('auto-selects provider based on environment variables', () => {
    delete process.env.DEEPSEEK_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-mock-key';

    const provider = getProvider();
    expect(provider.id).toBe('openai');
  });

  it('sanitizes diagnostic payload removing secret values', () => {
    const results: CheckResult[] = [
      {
        id: 'env-files',
        name: 'Environment Variables',
        category: 'env',
        status: 'error',
        message: 'DATABASE_URL=postgres://root:supersecretpassword@127.0.0.1:5432/app is missing',
        fixable: false,
      },
      {
        id: 'node-version',
        name: 'Node.js Version',
        category: 'node',
        status: 'success',
        message: 'Node.js satisfies version',
        fixable: false,
      },
    ];

    const payload = buildSanitizedDiagnosticPayload(results);
    expect(payload.issues).toHaveLength(1);
    expect(payload.issues[0].message).not.toContain('supersecretpassword');
    expect(payload.issues[0].message).toContain('[REDACTED]');
  });

  it('executes chat completion with mocked fetch', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-mock-key';
    const provider = new OpenAICompatibleProvider();

    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Here is your diagnosis and suggested fixes.',
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }) as any;

    const explanation = await provider.explainIssues({
      runtime: { node: '22.0.0', platform: 'linux' },
      project: {},
      issues: [
        {
          severity: 'error',
          check: 'env',
          message: 'DATABASE_URL is missing',
        },
      ],
    });

    expect(explanation).toBe('Here is your diagnosis and suggested fixes.');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
