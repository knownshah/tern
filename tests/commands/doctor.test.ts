import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { doctorCommand } from '../../src/commands/doctor.js';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';

describe('commands/doctor', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('runs doctor and outputs json correctly', async () => {
    await testDir.writeFile(
      'package.json',
      JSON.stringify({
        name: 'test-app',
        version: '1.0.0',
        engines: { node: '>=18.0.0' },
        scripts: { build: 'echo build', dev: 'echo dev' },
      })
    );
    await testDir.mkdir('node_modules');

    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const exitCode = await doctorCommand({
      cwd: testDir.path,
      json: true,
    });

    consoleSpy.mockRestore();

    expect(output).toContain('"health"');
    const parsed = JSON.parse(output);
    expect(parsed.version).toBe('0.1.0');
    expect(parsed.results).toBeInstanceOf(Array);
    expect(exitCode).toBe(0);
  });
});
