import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';
import { deployCommand, isLocalProviderEndpoint } from '../../src/commands/deploy.js';
import * as gitUtil from '../../src/utils/git.js';

describe('commands/deploy', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
    vi.spyOn(gitUtil, 'isFileTrackedByGit').mockResolvedValue(false);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await testDir.cleanup();
  });

  it('uses balanced non-absolute wording and never claims absolute production readiness', async () => {
    await testDir.writeFile(
      'package.json',
      JSON.stringify({
        name: 'deployable-app',
        scripts: { build: 'next build' },
      })
    );
    await testDir.writeFile('vercel.json', '{}');
    await testDir.mkdir('src');
    await testDir.writeFile('src/api.ts', 'export const API = process.env.API_URL;');

    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const exitCode = await deployCommand({ cwd: testDir.path });

    consoleSpy.mockRestore();

    expect(exitCode).toBe(0);
    // Non-absolute wording regression assertions
    expect(output).toContain('Deployment readiness checks passed.');
    expect(output).toContain('No deployment configuration blockers detected.');
    expect(output.toLowerCase()).not.toContain('ready for production');
  });

  it('detects tracked production secrets as blockers', async () => {
    await testDir.writeFile(
      'package.json',
      JSON.stringify({
        name: 'deployable-app',
        scripts: { build: 'next build' },
      })
    );

    // Mock tracked .env.production
    vi.spyOn(gitUtil, 'isFileTrackedByGit').mockImplementation(async (_cwd, file) => {
      return file === '.env.production';
    });

    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const exitCode = await deployCommand({ cwd: testDir.path });

    consoleSpy.mockRestore();

    expect(exitCode).toBe(1);
    expect(output).toContain('CRITICAL: .env.production is committed/tracked in Git');
  });

  describe('localhost detection false-positive prevention', () => {
    it('does not warn on Ollama default localhost endpoints (:11434)', async () => {
      await testDir.writeFile(
        'package.json',
        JSON.stringify({
          name: 'ollama-app',
          scripts: { build: 'tsup' },
        })
      );
      await testDir.writeFile('Dockerfile', 'FROM node:18');
      await testDir.mkdir('src/ai');
      await testDir.writeFile(
        'src/ai/ollama.ts',
        `export class OllamaProvider {
  getHost(): string {
    return process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  }
}`
      );

      let output = '';
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
        output += String(msg) + '\n';
      });

      const exitCode = await deployCommand({ cwd: testDir.path });

      consoleSpy.mockRestore();

      expect(exitCode).toBe(0);
      expect(output).toContain(
        'No hardcoded localhost/127.0.0.1 URLs detected in production source files'
      );
      expect(output).not.toContain('hardcoded localhost URL(s)');
    });

    it('warns on regular production API localhost', async () => {
      await testDir.writeFile(
        'package.json',
        JSON.stringify({
          name: 'prod-app',
          scripts: { build: 'next build' },
        })
      );
      await testDir.writeFile('vercel.json', '{}');
      await testDir.mkdir('src');
      await testDir.writeFile('src/api.ts', 'const api = "http://localhost:3000/api";');

      let output = '';
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
        output += String(msg) + '\n';
      });

      const exitCode = await deployCommand({ cwd: testDir.path });

      consoleSpy.mockRestore();

      expect(exitCode).toBe(0); // Warning does not block exit code unless failures
      expect(output).toContain('Found 1 hardcoded localhost URL(s) in source code');
      expect(output).toContain('src/api.ts:1 -> http://localhost:3000/api');
    });

    it('warns on ordinary 127.0.0.1 production URL', async () => {
      await testDir.writeFile(
        'package.json',
        JSON.stringify({
          name: 'prod-app',
          scripts: { build: 'next build' },
        })
      );
      await testDir.writeFile('vercel.json', '{}');
      await testDir.mkdir('src');
      await testDir.writeFile('src/backend.ts', 'const backend = "http://127.0.0.1:8000/v1";');

      let output = '';
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
        output += String(msg) + '\n';
      });

      const exitCode = await deployCommand({ cwd: testDir.path });

      consoleSpy.mockRestore();

      expect(exitCode).toBe(0);
      expect(output).toContain('Found 1 hardcoded localhost URL(s) in source code');
      expect(output).toContain('src/backend.ts:1 -> http://127.0.0.1:8000/v1');
    });

    it('does not warn on environment-configurable local provider', async () => {
      await testDir.writeFile(
        'package.json',
        JSON.stringify({
          name: 'ai-app',
          scripts: { build: 'next build' },
        })
      );
      await testDir.writeFile('vercel.json', '{}');
      await testDir.mkdir('src/providers');
      await testDir.writeFile(
        'src/providers/local.ts',
        `const localLLM = process.env.LOCAL_LLM_HOST || 'http://127.0.0.1:8080';
const customLocal = process.env.LOCAL_PROVIDER_URL || 'http://localhost:5000';`
      );

      let output = '';
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
        output += String(msg) + '\n';
      });

      const exitCode = await deployCommand({ cwd: testDir.path });

      consoleSpy.mockRestore();

      expect(exitCode).toBe(0);
      expect(output).toContain(
        'No hardcoded localhost/127.0.0.1 URLs detected in production source files'
      );
      expect(output).not.toContain('hardcoded localhost URL(s)');
    });
  });

  describe('isLocalProviderEndpoint unit checks', () => {
    it('recognizes Ollama default port 11434 on 127.0.0.1 and localhost', () => {
      expect(
        isLocalProviderEndpoint({
          file: 'src/ai/ollama.ts',
          line: 8,
          lineContent: "return 'http://127.0.0.1:11434';",
          matchedUrl: 'http://127.0.0.1:11434',
        })
      ).toBe(true);

      expect(
        isLocalProviderEndpoint({
          file: 'src/config.ts',
          line: 12,
          lineContent: "const endpoint = 'http://localhost:11434/api/chat';",
          matchedUrl: 'http://localhost:11434/api/chat',
        })
      ).toBe(true);
    });

    it('rejects regular production API URLs', () => {
      expect(
        isLocalProviderEndpoint({
          file: 'src/api.ts',
          line: 1,
          lineContent: 'const api = "http://localhost:3000/api";',
          matchedUrl: 'http://localhost:3000/api',
        })
      ).toBe(false);

      expect(
        isLocalProviderEndpoint({
          file: 'src/backend.ts',
          line: 1,
          lineContent: 'const backend = "http://127.0.0.1:8000/v1";',
          matchedUrl: 'http://127.0.0.1:8000/v1',
        })
      ).toBe(false);

      expect(
        isLocalProviderEndpoint({
          file: 'src/config.ts',
          line: 5,
          lineContent: "const api = process.env.API_URL || 'http://localhost:3000';",
          matchedUrl: 'http://localhost:3000',
        })
      ).toBe(false);
    });

    it('recognizes environment-configurable local provider overrides', () => {
      expect(
        isLocalProviderEndpoint({
          file: 'src/ai/local.ts',
          line: 5,
          lineContent: "const url = process.env.LOCAL_LLM_URL || 'http://127.0.0.1:8080';",
          matchedUrl: 'http://127.0.0.1:8080',
        })
      ).toBe(true);

      expect(
        isLocalProviderEndpoint({
          file: 'src/ai/provider.ts',
          line: 10,
          lineContent: "const host = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';",
          matchedUrl: 'http://127.0.0.1:11434',
        })
      ).toBe(true);
    });

    it('recognizes structured comment annotations', () => {
      expect(
        isLocalProviderEndpoint({
          file: 'src/service.ts',
          line: 10,
          lineContent: "const mockService = 'http://localhost:9000'; // local-provider",
          matchedUrl: 'http://localhost:9000',
        })
      ).toBe(true);

      expect(
        isLocalProviderEndpoint({
          file: 'src/service.ts',
          line: 11,
          prevLineContent: '// local-only daemon endpoint',
          lineContent: "const daemon = 'http://127.0.0.1:9090';",
          matchedUrl: 'http://127.0.0.1:9090',
        })
      ).toBe(true);
    });
  });
});
