import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gitEnvTrackedCheck } from '../../src/checks/git-env-tracked.js';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';
import { execCommand } from '../../src/utils/exec.js';

describe('checks/git-env-tracked', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('skips check if directory is not a git repository', async () => {
    const result = await gitEnvTrackedCheck.run({ cwd: testDir.path });
    expect(result.status).toBe('info');
    expect(result.message).toContain('Not a Git repository');
  });

  it('warns when .env is not ignored in .gitignore', async () => {
    await execCommand('git', ['init'], { cwd: testDir.path });
    await testDir.writeFile('.gitignore', 'node_modules\n');

    const result = await gitEnvTrackedCheck.run({ cwd: testDir.path });
    expect(result.status).toBe('warning');
    expect(result.message).toContain('.env is not ignored in .gitignore');
    expect(result.fixable).toBe(true);

    // Apply fix
    const fixResult = await result.fix!();
    expect(fixResult.success).toBe(true);

    const gitignore = await testDir.readFile('.gitignore');
    expect(gitignore).toContain('.env');
  });

  it('detects when .env is properly ignored', async () => {
    await execCommand('git', ['init'], { cwd: testDir.path });
    await testDir.writeFile('.gitignore', 'node_modules\n.env\n.env.*\n');

    const result = await gitEnvTrackedCheck.run({ cwd: testDir.path });
    expect(result.status).toBe('success');
    expect(result.message).toContain('.env files properly ignored by Git');
  });
});
