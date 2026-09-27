import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';
import { redactSecrets } from '../../src/utils/redact.js';
import { snapshotCommand } from '../../src/commands/snapshot.js';
import { reportCommand } from '../../src/commands/report.js';
import { buildSanitizedDiagnosticPayload } from '../../src/ai/sanitize.js';
import { scanMCPServers } from '../../src/mcp/scanner.js';
import type { CheckResult } from '../../src/types/index.js';

describe('security/secret-leakage-prevention', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  const SAMPLE_DB_PASS = 'SuperSecretDbPassword123';
  const SAMPLE_SECRETS = {
    dbUrl: `postgres://admin:${SAMPLE_DB_PASS}@db.example.com:5432/production`,
    githubToken: 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ab',
    awsKey: 'AKIAIOSFODNN7EXAMPLE',
    openaiKey: 'sk-proj-abc1234567890abcdef1234567890abcdef',
    deepseekKey: 'sk-deepseek1234567890abcdef1234567890ab',
    jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignaturePart12345',
    privateKey: `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y1+abcdef
secretPrivateKeyPayloadDataHere
-----END RSA PRIVATE KEY-----`,
  };

  it('redactSecrets prevents leakage of all sensitive credentials', () => {
    for (const [key, secret] of Object.entries(SAMPLE_SECRETS)) {
      const input = `Error connecting with credentials: ${secret}`;
      const redacted = redactSecrets(input);

      if (key === 'dbUrl') {
        expect(redacted).not.toContain(SAMPLE_DB_PASS);
        expect(redacted).not.toContain(`admin:${SAMPLE_DB_PASS}`);
      } else if (key === 'privateKey') {
        expect(redacted).not.toContain('secretPrivateKeyPayloadDataHere');
      } else {
        expect(redacted).not.toContain(secret);
      }
    }
  });

  it('tern snapshot NEVER includes secret values from .env', async () => {
    await testDir.writeFile(
      '.env',
      [
        `DATABASE_URL=${SAMPLE_SECRETS.dbUrl}`,
        `GITHUB_TOKEN=${SAMPLE_SECRETS.githubToken}`,
        `AWS_ACCESS_KEY_ID=${SAMPLE_SECRETS.awsKey}`,
        `OPENAI_API_KEY=${SAMPLE_SECRETS.openaiKey}`,
        `DEEPSEEK_API_KEY=${SAMPLE_SECRETS.deepseekKey}`,
        `AUTH_JWT=${SAMPLE_SECRETS.jwt}`,
      ].join('\n')
    );

    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const exitCode = await snapshotCommand({ cwd: testDir.path });
    consoleSpy.mockRestore();

    expect(exitCode).toBe(0);

    // Verify presence of keys
    expect(output).toContain('DATABASE_URL');
    expect(output).toContain('GITHUB_TOKEN');
    expect(output).toContain('AWS_ACCESS_KEY_ID');

    // MUST NOT contain any secret values
    expect(output).not.toContain(SAMPLE_DB_PASS);
    expect(output).not.toContain(SAMPLE_SECRETS.githubToken);
    expect(output).not.toContain(SAMPLE_SECRETS.awsKey);
    expect(output).not.toContain(SAMPLE_SECRETS.openaiKey);
    expect(output).not.toContain(SAMPLE_SECRETS.deepseekKey);
    expect(output).not.toContain(SAMPLE_SECRETS.jwt);
  });

  it('tern report NEVER includes secret values in markdown output', async () => {
    await testDir.writeFile(
      '.env',
      `DATABASE_URL=${SAMPLE_SECRETS.dbUrl}\nGITHUB_TOKEN=${SAMPLE_SECRETS.githubToken}\n`
    );

    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    await reportCommand({ cwd: testDir.path });
    consoleSpy.mockRestore();

    expect(output).not.toContain(SAMPLE_DB_PASS);
    expect(output).not.toContain('admin:SuperSecretDbPassword123');
    expect(output).not.toContain(SAMPLE_SECRETS.githubToken);
  });

  it('AI payload sanitization strictly removes secrets before transmission', () => {
    const rawResults: CheckResult[] = [
      {
        id: 'db-check',
        name: 'Database URL Check',
        category: 'env',
        status: 'error',
        message: `Connection failed to ${SAMPLE_SECRETS.dbUrl}`,
        hint: `Check key ${SAMPLE_SECRETS.openaiKey}`,
        fixable: false,
      },
      {
        id: 'token-check',
        name: 'GitHub Auth',
        category: 'security',
        status: 'warning',
        message: `Token ${SAMPLE_SECRETS.githubToken} has insufficient scopes`,
        fixable: false,
      },
    ];

    const sanitized = buildSanitizedDiagnosticPayload(rawResults);
    const jsonStr = JSON.stringify(sanitized);

    expect(jsonStr).not.toContain(SAMPLE_DB_PASS);
    expect(jsonStr).not.toContain('admin:SuperSecretDbPassword123');
    expect(jsonStr).not.toContain(SAMPLE_SECRETS.openaiKey);
    expect(jsonStr).not.toContain(SAMPLE_SECRETS.githubToken);
  });

  it('MCP scanner sanitizes environment variables to configured/missing status', async () => {
    await testDir.writeFile(
      '.mcp.json',
      JSON.stringify({
        mcpServers: {
          secure_server: {
            command: 'node',
            env: {
              GITHUB_TOKEN: SAMPLE_SECRETS.githubToken,
              DATABASE_URL: SAMPLE_SECRETS.dbUrl,
              CUSTOM_SECRET: 'very_secret_unpredictable_key_12345',
            },
          },
        },
      })
    );

    const mcpScan = await scanMCPServers({ cwd: testDir.path });
    const server = mcpScan.servers.find((s) => s.name === 'secure_server');
    expect(server).toBeDefined();

    // Verify envStatus only has configured/missing
    expect(server?.envStatus.GITHUB_TOKEN).toBe('configured');
    expect(server?.envStatus.DATABASE_URL).toBe('configured');
    expect(server?.envStatus.CUSTOM_SECRET).toBe('configured');

    const json = JSON.stringify(mcpScan);
    expect(json).not.toContain(SAMPLE_SECRETS.githubToken);
    expect(json).not.toContain(SAMPLE_DB_PASS);
    expect(json).not.toContain('very_secret_unpredictable_key_12345');
  });
});
