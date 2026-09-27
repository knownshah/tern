import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';
import { explainCommand } from '../../src/commands/explain.js';
import { hasAnsiCodes } from '../helpers/ansi.js';

describe('commands/explain', () => {
  let testDir: TestDirectory;
  const originalEnv = process.env;

  beforeEach(async () => {
    testDir = await createTestDir();
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    await testDir.cleanup();
  });

  it('reports healthy environment when no issues exist', async () => {
    await testDir.writeFile(
      'package.json',
      JSON.stringify({
        name: 'healthy-app',
        version: '1.0.0',
        engines: { node: '>=18.0.0' },
        scripts: { build: 'echo ok', start: 'echo ok' },
      })
    );
    await testDir.mkdir('node_modules');
    await testDir.writeFile(
      '.ternrc.json',
      JSON.stringify({
        ignoreChecks: ['git-status', 'package-manager', 'outdated-deps', 'deploy-config'],
      })
    );

    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const exitCode = await explainCommand({
      cwd: testDir.path,
      json: true,
    });

    consoleSpy.mockRestore();

    expect(hasAnsiCodes(output)).toBe(false);
    expect(output).toContain('"healthy"');
    const parsed = JSON.parse(output.trim());
    expect(parsed.issues).toHaveLength(0);
    expect(exitCode).toBe(0);
  });

  it('explains diagnosed issues with mocked AI provider', async () => {
    // Missing package.json scripts and dependencies will cause warnings/issues
    await testDir.writeFile('package.json', JSON.stringify({ name: 'issue-app' }));

    process.env.OPENAI_API_KEY = 'sk-mock-token';

    const mockApiResponse = {
      choices: [
        {
          message: {
            content: 'Analysis: Missing dependencies. Remediation: Run pnpm install.',
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    }) as any;

    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const exitCode = await explainCommand({
      cwd: testDir.path,
      provider: 'openai',
      json: true,
    });

    consoleSpy.mockRestore();

    expect(hasAnsiCodes(output)).toBe(false);
    expect(output).toContain('Remediation: Run pnpm install');
    const parsed = JSON.parse(output.trim());
    expect(parsed.provider).toBe('OpenAI-Compatible');
    expect(parsed.explanation).toContain('Remediation: Run pnpm install');
    expect(exitCode).toBe(0);
  });
});
