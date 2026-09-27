/**
 * Centralized secret redaction and sanitization utility.
 * Ensures zero secret leakage in logs, outputs, reports, snapshots, and AI requests.
 */

// Regex patterns to detect and redact sensitive values
const DB_URL_REGEX = /\b([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^:]+):([^@\s/]+)@/g;
const GITHUB_TOKEN_REGEX = /\b(gh[pous]_[A-Za-z0-9_]{36,255}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})\b/g;
const AWS_KEY_REGEX = /\b(AKIA[0-9A-Z]{16})\b/g;
const API_KEY_REGEX = /\b(sk-(?:proj-|live-)?[a-zA-Z0-9_-]{20,})\b/g;
const SLACK_TOKEN_REGEX = /\b(xox[baprs]-[0-9A-Za-z]{10,48})\b/g;
const STRIPE_KEY_REGEX = /\b(sk_live_[0-9a-zA-Z]{24,32})\b/g;
const JWT_REGEX = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/g;
const PRIVATE_KEY_REGEX = /-----BEGIN (?:[A-Z0-9 ]+)?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9 ]+)?PRIVATE KEY-----/g;
const BEARER_REGEX = /\b(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi;

// Sensitive environment variable or key patterns
const SENSITIVE_KEY_NAMES = [
  'KEY',
  'SECRET',
  'TOKEN',
  'PASSWORD',
  'PASS',
  'AUTH',
  'CREDENTIAL',
  'PRIVATE',
  'DATABASE_URL',
  'MONGO_URI',
  'REDIS_URL',
  'API_KEY',
  'ACCESS_KEY',
];

/**
 * Checks whether an environment variable or config key name suggests sensitive content.
 */
export function isSensitiveKeyName(keyName: string): boolean {
  const upper = keyName.toUpperCase();
  return SENSITIVE_KEY_NAMES.some((sensitive) => upper.includes(sensitive));
}

/**
 * Redacts any detected secrets, credentials, tokens, or private keys from a string.
 */
export function redactSecrets(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let result = text;

  // 1. Redact Private Key blocks
  result = result.replace(PRIVATE_KEY_REGEX, '[REDACTED_PRIVATE_KEY]');

  // 2. Redact Database connection URLs with passwords: proto://user:password@host
  result = result.replace(DB_URL_REGEX, '$1$2:[REDACTED]@');

  // 3. Redact GitHub tokens
  result = result.replace(GITHUB_TOKEN_REGEX, '[REDACTED_GITHUB_TOKEN]');

  // 4. Redact AWS access keys
  result = result.replace(AWS_KEY_REGEX, '[REDACTED_AWS_KEY]');

  // 5. Redact Generic API keys (OpenAI, DeepSeek, Anthropic, etc.)
  result = result.replace(API_KEY_REGEX, '[REDACTED_API_KEY]');

  // 6. Redact Slack tokens
  result = result.replace(SLACK_TOKEN_REGEX, '[REDACTED_SLACK_TOKEN]');

  // 7. Redact Stripe secret keys
  result = result.replace(STRIPE_KEY_REGEX, '[REDACTED_STRIPE_KEY]');

  // 8. Redact JWT tokens
  result = result.replace(JWT_REGEX, '[REDACTED_JWT]');

  // 9. Redact Authorization Bearer tokens
  result = result.replace(BEARER_REGEX, '$1[REDACTED]');

  return result;
}

/**
 * Sanitizes an environment or config dictionary, replacing actual values with
 * status ('configured' | 'missing'). Never exposes values.
 */
export function sanitizeEnvRecord(
  record: Record<string, any> = {}
): Record<string, 'configured' | 'missing'> {
  const sanitized: Record<string, 'configured' | 'missing'> = {};

  for (const [key, val] of Object.entries(record)) {
    const isConfigured = val !== undefined && val !== null && String(val).trim().length > 0;
    sanitized[key] = isConfigured ? 'configured' : 'missing';
  }

  return sanitized;
}

/**
 * Deep sanitization for structured diagnostic data before printing or sending to AI.
 */
export function sanitizeDiagnostics<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return redactSecrets(data) as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeDiagnostics(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (isSensitiveKeyName(key) && typeof value === 'string') {
        cleaned[key] = '[REDACTED]';
      } else {
        cleaned[key] = sanitizeDiagnostics(value);
      }
    }
    return cleaned as T;
  }

  return data;
}
