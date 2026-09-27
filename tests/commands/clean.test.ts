import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanCommand } from '../../src/commands/clean.js';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';

describe('commands/clean', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('deletes cache and build directories with --yes flag', async () => {
    await testDir.writeFile('dist/bundle.js', 'console.log("build")');
    await testDir.writeFile('node_modules/.cache/cache.json', '{}');
    await testDir.writeFile('.next/cache.txt', 'next');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await cleanCommand({
      cwd: testDir.path,
      yes: true,
    });

    consoleSpy.mockRestore();

    expect(exitCode).toBe(0);
    const distExists = await testDir.exists('dist');
    const nextExists = await testDir.exists('.next');
    const cacheExists = await testDir.exists('node_modules/.cache');

    expect(distExists).toBe(false);
    expect(nextExists).toBe(false);
    expect(cacheExists).toBe(false);
  });

  it('preserves files during dry-run', async () => {
    await testDir.writeFile('dist/app.js', 'hello');

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await cleanCommand({
      cwd: testDir.path,
      dryRun: true,
    });

    consoleSpy.mockRestore();

    expect(exitCode).toBe(0);
    const distExists = await testDir.exists('dist');
    expect(distExists).toBe(true);
  });
});
