import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { nodeVersionCheck } from '../../src/checks/node-version.js';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';

describe('checks/node-version', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('passes when current node version satisfies requirement', async () => {
    const result = await nodeVersionCheck.run({
      cwd: testDir.path,
      pkg: { engines: { node: '>=18.0.0' } },
    });

    expect(result.status).toBe('success');
    expect(result.message).toContain('satisfies >=18.0.0');
  });

  it('fails when node version does not satisfy high version range', async () => {
    const result = await nodeVersionCheck.run({
      cwd: testDir.path,
      pkg: { engines: { node: '>=99.0.0' } },
    });

    expect(result.status).toBe('error');
    expect(result.message).toContain('does not satisfy >=99.0.0');
    expect(result.hint).toBeDefined();
  });

  it('reads requirement from .nvmrc if engines is not defined', async () => {
    await testDir.writeFile('.nvmrc', '20.10.0\n');

    const result = await nodeVersionCheck.run({
      cwd: testDir.path,
      pkg: {},
    });

    expect(result.message).toContain('.nvmrc');
  });
});
