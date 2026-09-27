import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { packageManagerCheck } from '../../src/checks/package-manager.js';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';

describe('checks/package-manager', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('detects pnpm when pnpm-lock.yaml is present', async () => {
    await testDir.writeFile('pnpm-lock.yaml', 'lockfileVersion: 5.4\n');

    const result = await packageManagerCheck.run({
      cwd: testDir.path,
      pkg: {},
    });

    expect(result.status).toBe('success');
    expect(result.message).toContain('pnpm');
  });

  it('warns when no lockfile exists', async () => {
    const result = await packageManagerCheck.run({
      cwd: testDir.path,
      pkg: {},
    });

    expect(result.status).toBe('warning');
    expect(result.message).toContain('No lockfile found');
  });

  it('detects conflicting lockfiles and offers automated fix', async () => {
    await testDir.writeFile('pnpm-lock.yaml', '');
    await testDir.writeFile('package-lock.json', '{}');

    const result = await packageManagerCheck.run({
      cwd: testDir.path,
      pkg: { packageManager: 'pnpm@12.4.2' },
    });

    expect(result.status).toBe('warning');
    expect(result.message).toContain('Conflicting lockfiles detected');
    expect(result.fixable).toBe(true);

    // Test fix execution
    expect(result.fix).toBeDefined();
    const fixResult = await result.fix!();
    expect(fixResult.success).toBe(true);

    // Verify redundant package-lock.json is removed and pnpm-lock.yaml is kept
    const hasPnpm = await testDir.exists('pnpm-lock.yaml');
    const hasNpm = await testDir.exists('package-lock.json');
    expect(hasPnpm).toBe(true);
    expect(hasNpm).toBe(false);
  });
});
