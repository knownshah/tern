import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { deployConfigCheck } from '../../src/checks/deploy-config.js';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';

describe('checks/deploy-config', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('detects Dockerfile and validates configuration', async () => {
    await testDir.writeFile('Dockerfile', 'FROM node:20-alpine\nWORKDIR /app\n');

    const result = await deployConfigCheck.run({
      cwd: testDir.path,
      pkg: { scripts: { build: 'tsup' } },
    });

    expect(result.status).toBe('success');
    expect(result.message).toContain('Dockerfile');
  });

  it('reports error when vercel.json has invalid JSON syntax', async () => {
    await testDir.writeFile('vercel.json', '{ invalid json ');

    const result = await deployConfigCheck.run({
      cwd: testDir.path,
      pkg: { scripts: { build: 'tsup' } },
    });

    expect(result.status).toBe('warning');
    expect(result.message).toContain('Invalid JSON syntax in vercel.json');
  });

  it('warns when deploy config exists but package.json has no build script', async () => {
    await testDir.writeFile('vercel.json', '{}');

    const result = await deployConfigCheck.run({
      cwd: testDir.path,
      pkg: { scripts: {} },
    });

    expect(result.status).toBe('warning');
    expect(result.details).toContain(
      'Missing "build" script in package.json for production deployment'
    );
  });
});
