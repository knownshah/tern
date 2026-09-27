import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fixCommand } from '../../src/commands/fix.js';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';

describe('commands/fix', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('automatically applies fixes when --yes is specified', async () => {
    // Setup missing .env while .env.example exists
    await testDir.writeFile('.env.example', 'PORT=3000\nSECRET_KEY=\n');
    await testDir.writeFile(
      'package.json',
      JSON.stringify({
        name: 'fix-test',
        version: '1.0.0',
        scripts: { build: 'tsc', dev: 'vite' },
      })
    );
    await testDir.mkdir('node_modules');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await fixCommand({
      cwd: testDir.path,
      yes: true,
    });

    consoleSpy.mockRestore();

    expect(exitCode).toBe(0);
    const envExists = await testDir.exists('.env');
    expect(envExists).toBe(true);

    const envContent = await testDir.readFile('.env');
    expect(envContent).toContain('PORT=');
    expect(envContent).toContain('SECRET_KEY=');
  });

  it('exits cleanly with 0 when no issues need fixing', async () => {
    await testDir.writeFile(
      'package.json',
      JSON.stringify({
        name: 'clean-test',
        version: '1.0.0',
        scripts: { build: 'tsc', dev: 'vite' },
      })
    );
    await testDir.mkdir('node_modules');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitCode = await fixCommand({
      cwd: testDir.path,
      yes: true,
    });
    consoleSpy.mockRestore();

    expect(exitCode).toBe(0);
  });
});
