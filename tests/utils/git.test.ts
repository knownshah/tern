import { describe, it, expect } from 'vitest';
import { scanContentForSecrets } from '../../src/utils/git.js';

describe('utils/git - Secret Scanning', () => {
  it('detects AWS Access Keys', () => {
    const content = `
      const config = {
        awsKey: "AKIAIOSFODNN7EXAMPLE",
      };
    `;
    const findings = scanContentForSecrets(content, 'test.js');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].patternName).toBe('AWS Access Key ID');
  });

  it('detects GitHub Personal Access Tokens', () => {
    const content = 'const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";';
    const findings = scanContentForSecrets(content, 'api.ts');
    expect(findings.length).toBe(1);
    expect(findings[0].patternName).toBe('GitHub Token');
  });

  it('detects Private Key Blocks', () => {
    const content = `
      -----BEGIN RSA PRIVATE KEY-----
      MIIEowIBAAKCAQEA0Y123...
      -----END RSA PRIVATE KEY-----
    `;
    const findings = scanContentForSecrets(content, 'id_rsa');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].patternName).toBe('Private Key');
  });

  it('ignores benign lines with comments containing placeholder or example', () => {
    const content = '// example placeholder dummy key';
    const findings = scanContentForSecrets(content, 'readme.md');
    expect(findings.length).toBe(0);
  });
});
