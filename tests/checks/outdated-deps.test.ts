import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { outdatedDepsCheck } from '../../src/checks/outdated-deps.js';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';

describe('checks/outdated-deps', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('warns when dependencies use wildcard or latest versions', async () => {
    const result = await outdatedDepsCheck.run({
      cwd: testDir.path,
      pkg: {
        dependencies: {
          express: '*',
          lodash: 'latest',
        },
      },
    });

    expect(result.status).toBe('warning');
    expect(result.message).toContain('wildcard/unpinned version');
    expect(result.details?.length).toBe(2);
  });

  it('handles empty dependencies gracefully', async () => {
    const result = await outdatedDepsCheck.run({
      cwd: testDir.path,
      pkg: {},
    });

    expect(result.status).toBe('info');
    expect(result.message).toContain('No dependencies declared');
  });
});
