import { describe, it, expect } from 'vitest';
import {
  redactSecrets,
  sanitizeEnvRecord,
  sanitizeDiagnostics,
  isSensitiveKeyName,
} from '../../src/utils/redact.js';

describe('utils/redact', () => {
  it('redacts database credentials in URLs', () => {
    const input = 'DATABASE_URL=postgres://myuser:secretpassword123@localhost:5432/mydb';
    const redacted = redactSecrets(input);

    expect(redacted).not.toContain('secretpassword123');
    expect(redacted).not.toContain('postgres://myuser:secretpassword123');
    expect(redacted).toContain('postgres://myuser:[REDACTED]@localhost:5432/mydb');
  });

  it('redacts GitHub personal access tokens', () => {
    const input = 'token: ghp_1234567890abcdefghijklmnopqrstuvwxyzAB';
    const redacted = redactSecrets(input);

    expect(redacted).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyzAB');
    expect(redacted).toContain('[REDACTED_GITHUB_TOKEN]');
  });

  it('redacts AWS Access Key IDs', () => {
    const input = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
    const redacted = redactSecrets(input);

    expect(redacted).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(redacted).toContain('[REDACTED_AWS_KEY]');
  });

  it('redacts OpenAI / DeepSeek API keys', () => {
    const input = 'key is sk-proj-1234567890abcdef1234567890abcdef';
    const redacted = redactSecrets(input);

    expect(redacted).not.toContain('sk-proj-1234567890abcdef1234567890abcdef');
    expect(redacted).toContain('[REDACTED_API_KEY]');
  });

  it('redacts JWT tokens', () => {
    const input =
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const redacted = redactSecrets(input);

    expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(redacted).toContain('[REDACTED_JWT]');
  });

  it('redacts Private Key blocks completely', () => {
    const input = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y1+xyz...
fakePrivateKeyContent12345
-----END RSA PRIVATE KEY-----`;
    const redacted = redactSecrets(input);

    expect(redacted).not.toContain('fakePrivateKeyContent12345');
    expect(redacted).toContain('[REDACTED_PRIVATE_KEY]');
  });

  it('sanitizes environment records to configured/missing status without values', () => {
    const env = {
      GITHUB_TOKEN: 'ghp_secret_token_value',
      DATABASE_URL: 'postgres://user:pass@host/db',
      PORT: '3000',
      EMPTY_VAL: '',
    };

    const sanitized = sanitizeEnvRecord(env);

    expect(sanitized.GITHUB_TOKEN).toBe('configured');
    expect(sanitized.DATABASE_URL).toBe('configured');
    expect(sanitized.PORT).toBe('configured');
    expect(sanitized.EMPTY_VAL).toBe('missing');

    // Make sure no values leaked
    expect(JSON.stringify(sanitized)).not.toContain('ghp_secret_token_value');
    expect(JSON.stringify(sanitized)).not.toContain('pass');
  });

  it('identifies sensitive key names correctly', () => {
    expect(isSensitiveKeyName('DATABASE_URL')).toBe(true);
    expect(isSensitiveKeyName('OPENAI_API_KEY')).toBe(true);
    expect(isSensitiveKeyName('AUTH_SECRET')).toBe(true);
    expect(isSensitiveKeyName('PASSWORD')).toBe(true);
    expect(isSensitiveKeyName('NODE_ENV')).toBe(false);
    expect(isSensitiveKeyName('PORT')).toBe(false);
  });

  it('deeply sanitizes diagnostics data structures', () => {
    const diagnostics = {
      runtime: 'node 22.0.0',
      database: 'postgres://admin:supersecret@127.0.0.1/prod',
      SECRET_TOKEN: 'topsecretvalue',
      nested: {
        api_key: 'sk-1234567890abcdef1234567890',
      },
    };

    const cleaned = sanitizeDiagnostics(diagnostics);

    expect(JSON.stringify(cleaned)).not.toContain('supersecret');
    expect(JSON.stringify(cleaned)).not.toContain('topsecretvalue');
    expect(JSON.stringify(cleaned)).not.toContain('sk-1234567890abcdef1234567890');
    expect(cleaned.SECRET_TOKEN).toBe('[REDACTED]');
  });
});
