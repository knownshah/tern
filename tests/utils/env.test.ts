import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractEnvKeys, compareEnvFiles, addMissingKeysToEnv } from '../../src/utils/env.js';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';

describe('utils/env', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  describe('extractEnvKeys', () => {
    it('extracts keys and never stores secret values', () => {
      const sample = `
        # This is a comment
        PORT=3000
        DATABASE_URL=postgres://user:super_secret_password@localhost:5432/db
        API_SECRET="extremely_sensitive_token"
        EMPTY_VAR=
        ANOTHER_EMPTY=""
        export JWT_SECRET='very_confidential'
      `;

      const result = extractEnvKeys(sample);
      expect(result.keys).toEqual([
        'PORT',
        'DATABASE_URL',
        'API_SECRET',
        'EMPTY_VAR',
        'ANOTHER_EMPTY',
        'JWT_SECRET',
      ]);
      expect(result.emptyKeys).toEqual(['EMPTY_VAR', 'ANOTHER_EMPTY']);

      // Ensure secret values are not in keys array
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('super_secret_password');
      expect(serialized).not.toContain('extremely_sensitive_token');
      expect(serialized).not.toContain('very_confidential');
    });

    it('ignores empty lines and comments', () => {
      const sample = `
        # Comment line 1
        # Comment line 2
        
        VALID_KEY=test
      `;
      const result = extractEnvKeys(sample);
      expect(result.keys).toEqual(['VALID_KEY']);
    });
  });

  describe('compareEnvFiles', () => {
    it('detects missing keys from .env.example', async () => {
      await testDir.writeFile(
        '.env.example',
        'PORT=3000\nDATABASE_URL=\nAPI_KEY=\nOPTIONAL_VAR=\n'
      );
      await testDir.writeFile(
        '.env',
        'PORT=3000\nDATABASE_URL=postgres://localhost/test\nEXTRA_LOCAL=123\n'
      );

      const analysis = await compareEnvFiles(testDir.path);
      expect(analysis.hasEnvExample).toBe(true);
      expect(analysis.hasEnv).toBe(true);
      expect(analysis.missingKeys).toEqual(['API_KEY', 'OPTIONAL_VAR']);
      expect(analysis.extraKeys).toEqual(['EXTRA_LOCAL']);
    });

    it('reports missing .env file when only .env.example exists', async () => {
      await testDir.writeFile('.env.example', 'PORT=3000\nSECRET=abc\n');

      const analysis = await compareEnvFiles(testDir.path);
      expect(analysis.hasEnvExample).toBe(true);
      expect(analysis.hasEnv).toBe(false);
      expect(analysis.missingKeys).toEqual(['PORT', 'SECRET']);
    });
  });

  describe('addMissingKeysToEnv', () => {
    it('creates .env with placeholder keys if it does not exist', async () => {
      await addMissingKeysToEnv(testDir.path, ['API_KEY', 'DATABASE_URL']);

      const exists = await testDir.exists('.env');
      expect(exists).toBe(true);
      const content = await testDir.readFile('.env');
      expect(content).toContain('API_KEY=');
      expect(content).toContain('DATABASE_URL=');
    });

    it('appends missing keys without overwriting existing content', async () => {
      await testDir.writeFile('.env', 'EXISTING_KEY=hello\n');
      await addMissingKeysToEnv(testDir.path, ['NEW_KEY']);

      const content = await testDir.readFile('.env');
      expect(content).toContain('EXISTING_KEY=hello');
      expect(content).toContain('NEW_KEY=');
    });
  });
});
