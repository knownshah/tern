import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { envFilesCheck } from '../../src/checks/env-files.js';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';

describe('checks/env-files', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('passes when .env and .env.example are in sync', async () => {
    await testDir.writeFile('.env.example', 'PORT=3000\nDATABASE_URL=\n');
    await testDir.writeFile(
      '.env',
      'PORT=3000\nDATABASE_URL=postgres://super_secret_credentials@db:5432/main\n'
    );

    const result = await envFilesCheck.run({ cwd: testDir.path });
    expect(result.status).toBe('success');
    expect(result.message).toContain('Environment variables synced');

    // Never leak secrets
    expect(result.message).not.toContain('super_secret_credentials');
  });

  it('fails when .env is missing and .env.example exists', async () => {
    await testDir.writeFile('.env.example', 'API_KEY=\nSECRET_TOKEN=\nDATABASE_URL=\n');

    const result = await envFilesCheck.run({ cwd: testDir.path });
    expect(result.status).toBe('error');
    expect(result.message).toContain('Missing .env file');
    expect(result.fixable).toBe(true);

    // Test fix
    const fixRes = await result.fix!();
    expect(fixRes.success).toBe(true);

    const envExists = await testDir.exists('.env');
    expect(envExists).toBe(true);
    const envContent = await testDir.readFile('.env');
    expect(envContent).toContain('API_KEY=');
    expect(envContent).toContain('SECRET_TOKEN=');
  });

  it('flags missing keys and never displays secret values', async () => {
    await testDir.writeFile('.env.example', 'PORT=3000\nDATABASE_URL=\nREDIS_URL=\n');
    await testDir.writeFile('.env', 'PORT=3000\nDATABASE_URL=postgres://real_db_pass@host/prod\n');

    const result = await envFilesCheck.run({ cwd: testDir.path });
    expect(result.status).toBe('error');
    expect(result.message).toContain('Missing 1 environment variable(s) from .env: REDIS_URL');
    expect(result.details).toContain('Missing key: REDIS_URL');
    expect(result.fixable).toBe(true);

    // Verify secrets are nowhere in result object
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('real_db_pass');
  });
});
