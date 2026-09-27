import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';
import { snapshotCommand } from '../../src/commands/snapshot.js';
import { hasAnsiCodes } from '../helpers/ansi.js';

describe('commands/snapshot', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('generates non-sensitive environment snapshot and saves to file', async () => {
    await testDir.writeFile(
      'package.json',
      JSON.stringify({
        name: 'sample-project',
        version: '1.2.3',
        dependencies: {
          next: '14.2.0',
        },
      })
    );

    await testDir.writeFile(
      '.env',
      'DATABASE_URL=postgres://user:super_secret_pw@localhost:5432/db\nPORT=3000\n'
    );

    const outPath = 'snapshot.json';
    const exitCode = await snapshotCommand({
      cwd: testDir.path,
      output: outPath,
    });

    expect(exitCode).toBe(0);
    const content = await testDir.readFile(outPath);
    const parsed = JSON.parse(content);

    // Verify metadata presence
    expect(parsed.schemaVersion).toBe('1.0.0');
    expect(parsed.runtime.node).toBeDefined();
    expect(parsed.project.name).toBe('sample-project');
    expect(parsed.project.framework).toBe('nextjs');

    // CRITICAL: Ensure NO secrets or values leak
    expect(parsed.environment.keysPresent).toContain('DATABASE_URL');
    expect(parsed.environment.keysPresent).toContain('PORT');
    expect(content).not.toContain('super_secret_pw');
    expect(content).not.toContain('postgres://user');
  });

  it('outputs strictly valid single JSON document to stdout when no -o is provided', async () => {
    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const exitCode = await snapshotCommand({
      cwd: testDir.path,
    });

    consoleSpy.mockRestore();

    expect(hasAnsiCodes(output)).toBe(false);
    const parsed = JSON.parse(output.trim());
    expect(parsed.schemaVersion).toBe('1.0.0');
    expect(parsed).toHaveProperty('runtime');
    expect(exitCode).toBe(0);
  });
});
