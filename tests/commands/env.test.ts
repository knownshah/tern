import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { envCommand } from '../../src/commands/env.js';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';

describe('commands/env', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('syncs missing env variables when --sync flag is provided', async () => {
    await testDir.writeFile('.env.example', 'PORT=3000\nDATABASE_URL=\nAPI_KEY=\n');
    await testDir.writeFile('.env', 'PORT=3000\n');

    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const exitCode = await envCommand({
      cwd: testDir.path,
      sync: true,
    });

    consoleSpy.mockRestore();

    expect(exitCode).toBe(0);
    expect(output).toContain('Syncing');
    const envContent = await testDir.readFile('.env');
    expect(envContent).toContain('DATABASE_URL=');
    expect(envContent).toContain('API_KEY=');
  });

  it('fails with exit code 1 if missing keys and no --sync', async () => {
    await testDir.writeFile('.env.example', 'REQUIRED_VAR=\n');
    await testDir.writeFile('.env', '');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitCode = await envCommand({
      cwd: testDir.path,
      sync: false,
    });
    consoleSpy.mockRestore();

    expect(exitCode).toBe(1);
  });
});
