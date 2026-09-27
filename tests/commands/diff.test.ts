import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';
import { diffCommand } from '../../src/commands/diff.js';
import { hasAnsiCodes } from '../helpers/ansi.js';

describe('commands/diff', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('detects differences between local and server snapshots with blocking status', async () => {
    const localSnapshot = {
      schemaVersion: '1.0.0',
      runtime: { node: '22.18.0' },
      packageManager: { name: 'pnpm', version: '10.5.0' },
      environment: { keysPresent: ['DATABASE_URL', 'PORT'] },
      ports: [{ port: 3000, status: 'free' }],
      os: { arch: 'arm64', platform: 'darwin' },
    };

    const serverSnapshot = {
      schemaVersion: '1.0.0',
      runtime: { node: '20.19.1' },
      packageManager: { name: 'pnpm', version: '9.12.0' },
      environment: { keysPresent: ['PORT'] }, // DATABASE_URL is missing
      ports: [{ port: 3000, status: 'occupied', process: 'node' }],
      os: { arch: 'x64', platform: 'linux' },
    };

    const localFile = await testDir.writeFile('local.json', JSON.stringify(localSnapshot));
    const serverFile = await testDir.writeFile('server.json', JSON.stringify(serverSnapshot));

    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const exitCode = await diffCommand(localFile, serverFile, { json: true });

    consoleSpy.mockRestore();

    expect(hasAnsiCodes(output)).toBe(false);
    const parsed = JSON.parse(output.trim());
    expect(parsed.summary.total).toBeGreaterThan(0);
    expect(parsed.summary.blocking).toBeGreaterThan(0);

    const dbDiff = parsed.differences.find((d: any) => d.property === 'DATABASE_URL');
    expect(dbDiff).toBeDefined();
    expect(dbDiff.sourceValue).toBe('present');
    expect(dbDiff.targetValue).toBe('missing');
    expect(dbDiff.severity).toBe('blocking');

    const portDiff = parsed.differences.find((d: any) => d.property === 'Port 3000');
    expect(portDiff).toBeDefined();
    expect(portDiff.sourceValue).toBe('free');
    expect(portDiff.targetValue).toBe('occupied');

    // Blocking difference exits with code 1
    expect(exitCode).toBe(1);
  });

  it('exits with code 0 when no blocking differences exist', async () => {
    const snap1 = {
      schemaVersion: '1.0.0',
      runtime: { node: '22.18.0' },
      packageManager: { name: 'pnpm', version: '10.5.0' },
      environment: { keysPresent: ['PORT'] },
      ports: [{ port: 3000, status: 'free' }],
      os: { arch: 'arm64' },
    };

    const snap2 = {
      schemaVersion: '1.0.0',
      runtime: { node: '22.18.0' },
      packageManager: { name: 'pnpm', version: '10.5.0' },
      environment: { keysPresent: ['PORT'] },
      ports: [{ port: 3000, status: 'free' }],
      os: { arch: 'x64' }, // Only informational architecture difference
    };

    const f1 = await testDir.writeFile('s1.json', JSON.stringify(snap1));
    const f2 = await testDir.writeFile('s2.json', JSON.stringify(snap2));

    const exitCode = await diffCommand(f1, f2, { json: true });
    expect(exitCode).toBe(0);
  });
});
