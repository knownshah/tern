import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, DEFAULT_CONFIG } from '../../src/utils/config.js';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';

describe('utils/config', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('returns default config when no config file exists', async () => {
    const config = await loadConfig(testDir.path);
    expect(config.minNodeVersion).toBe(DEFAULT_CONFIG.minNodeVersion);
    expect(config.ports).toEqual(DEFAULT_CONFIG.ports);
  });

  it('loads and merges .ternrc.json', async () => {
    await testDir.writeFile(
      '.ternrc.json',
      JSON.stringify({
        ignoreChecks: ['port-conflicts'],
        ports: [4000, 4001],
      })
    );

    const config = await loadConfig(testDir.path);
    expect(config.ignoreChecks).toEqual(['port-conflicts']);
    expect(config.ports).toEqual([4000, 4001]);
    expect(config.cleanPaths).toEqual(DEFAULT_CONFIG.cleanPaths);
  });
});
