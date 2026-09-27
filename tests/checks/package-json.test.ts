import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { packageJsonCheck } from '../../src/checks/package-json.js';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';

describe('checks/package-json', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('fails when package.json is missing', async () => {
    const result = await packageJsonCheck.run({ cwd: testDir.path });
    expect(result.status).toBe('error');
    expect(result.message).toContain('Missing package.json');
  });

  it('fails when package.json has invalid JSON syntax', async () => {
    await testDir.writeFile('package.json', '{ name: "invalid" ');
    const result = await packageJsonCheck.run({ cwd: testDir.path });
    expect(result.status).toBe('error');
    expect(result.message).toContain('Invalid package.json syntax');
  });

  it('reports error when node_modules is missing', async () => {
    await testDir.writeFile(
      'package.json',
      JSON.stringify({
        name: 'test-app',
        version: '1.0.0',
        scripts: { dev: 'node index.js', build: 'tsc' },
      })
    );

    const result = await packageJsonCheck.run({ cwd: testDir.path });
    expect(result.status).toBe('error');
    expect(result.message).toContain('node_modules directory is missing');
    expect(result.fixable).toBe(true);
  });

  it('passes when valid package.json and node_modules exist', async () => {
    await testDir.writeFile(
      'package.json',
      JSON.stringify({
        name: 'test-app',
        version: '1.0.0',
        scripts: { dev: 'node index.js', build: 'tsc' },
      })
    );
    await testDir.mkdir('node_modules');

    const result = await packageJsonCheck.run({ cwd: testDir.path });
    expect(result.status).toBe('success');
    expect(result.message).toContain('package.json valid');
  });
});
