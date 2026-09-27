import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { reportCommand } from '../../src/commands/report.js';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';

describe('commands/report', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('generates report markdown and saves to file', async () => {
    await testDir.writeFile(
      'package.json',
      JSON.stringify({
        name: 'sample-project',
        version: '1.2.3',
      })
    );

    const outReportPath = 'report.md';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await reportCommand({
      cwd: testDir.path,
      output: outReportPath,
    });

    consoleSpy.mockRestore();

    expect(exitCode).toBe(0);
    const exists = await testDir.exists(outReportPath);
    expect(exists).toBe(true);

    const content = await testDir.readFile(outReportPath);
    expect(content).toContain('# 🩺 Tern Environment Diagnostic Report');
    expect(content).toContain('sample-project@1.2.3');
    expect(content).toContain('Project Health:');
  });
});
