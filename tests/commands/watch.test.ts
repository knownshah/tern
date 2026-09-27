import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';
import { isWatchedFile, startWatcher } from '../../src/watch/watcher.js';

describe('watch/watcher', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('correctly filters watched files from arbitrary project files', () => {
    expect(isWatchedFile('.env')).toBe(true);
    expect(isWatchedFile('.env.example')).toBe(true);
    expect(isWatchedFile('package.json')).toBe(true);
    expect(isWatchedFile('pnpm-lock.yaml')).toBe(true);
    expect(isWatchedFile('AGENTS.md')).toBe(true);
    expect(isWatchedFile('CLAUDE.md')).toBe(true);
    expect(isWatchedFile('.mcp.json')).toBe(true);
    expect(isWatchedFile('Dockerfile')).toBe(true);

    // Unwatched files
    expect(isWatchedFile('src/index.ts')).toBe(false);
    expect(isWatchedFile('image.png')).toBe(false);
    expect(isWatchedFile('dist/bundle.js')).toBe(false);
  });

  it('starts watcher and stops cleanly', async () => {
    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const watcher = await startWatcher({ cwd: testDir.path });

    consoleSpy.mockRestore();

    expect(output).toContain('Tern Watch');
    expect(output).toContain(testDir.path);

    expect(typeof watcher.stop).toBe('function');
    watcher.stop();
  });
});
