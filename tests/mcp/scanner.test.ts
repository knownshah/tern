import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';
import { scanMCPServers } from '../../src/mcp/scanner.js';

describe('mcp/scanner', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('detects healthy stdio server with existing binary', async () => {
    await testDir.writeFile(
      '.mcp.json',
      JSON.stringify({
        mcpServers: {
          node_test: {
            command: 'node',
            args: ['-e', 'console.log("ok")'],
            env: {
              SAFE_VAR: 'hello',
            },
          },
        },
      })
    );

    const result = await scanMCPServers({ cwd: testDir.path });
    expect(result.totalServers).toBeGreaterThanOrEqual(1);

    const server = result.servers.find((s) => s.name === 'node_test');
    expect(server).toBeDefined();
    expect(server?.status).toBe('healthy');
    expect(server?.executableFound).toBe(true);
    expect(server?.transport).toBe('stdio');
    // Ensure environment value is sanitized to configured, not the raw value
    expect(server?.envStatus.SAFE_VAR).toBe('configured');
    expect(JSON.stringify(server?.envStatus)).not.toContain('hello');
  });

  it('detects missing command in MCP config', async () => {
    await testDir.writeFile(
      'mcp.json',
      JSON.stringify({
        mcpServers: {
          ghost_server: {
            command: 'non_existent_binary_xyz_123',
            args: [],
          },
        },
      })
    );

    const result = await scanMCPServers({ cwd: testDir.path });
    const server = result.servers.find((s) => s.name === 'ghost_server');
    expect(server).toBeDefined();
    expect(server?.status).toBe('error');
    expect(server?.message).toBe('command not found');
    expect(server?.executableFound).toBe(false);
  });

  it('flags malformed configuration files', async () => {
    await testDir.writeFile('.mcp.json', '{ invalid json, not closed');

    const result = await scanMCPServers({ cwd: testDir.path });
    expect(result.malformedConfigs.length).toBeGreaterThan(0);
    expect(result.warningCount).toBeGreaterThan(0);
  });

  it('detects missing environment variable references', async () => {
    await testDir.writeFile(
      '.mcp.json',
      JSON.stringify({
        mcpServers: {
          github_server: {
            command: 'node',
            args: [],
            env: {
              GITHUB_TOKEN: '${DEFINITELY_MISSING_SECRET_ENV_VAR}',
            },
          },
        },
      })
    );

    const result = await scanMCPServers({ cwd: testDir.path });
    const server = result.servers.find((s) => s.name === 'github_server');
    expect(server).toBeDefined();
    expect(server?.status).toBe('warning');
    expect(server?.missingEnvVars).toContain('DEFINITELY_MISSING_SECRET_ENV_VAR');
    expect(server?.envStatus.GITHUB_TOKEN).toBe('missing');
  });

  it('detects duplicate server definitions', async () => {
    await testDir.writeFile(
      '.mcp.json',
      JSON.stringify({
        mcpServers: {
          dup_server: {
            command: 'node',
          },
        },
      })
    );
    await testDir.writeFile(
      '.claude.json',
      JSON.stringify({
        mcpServers: {
          dup_server: {
            command: 'node',
          },
        },
      })
    );

    const result = await scanMCPServers({ cwd: testDir.path });
    const duplicates = result.servers.filter((s) => s.name === 'dup_server');
    expect(duplicates.length).toBeGreaterThan(0);
    expect(duplicates.some((s) => s.duplicate)).toBe(true);
  });
});
