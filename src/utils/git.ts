import fs from 'node:fs/promises';
import path from 'node:path';
import { execCommand } from './exec.js';

export interface GitInfo {
  isRepo: boolean;
  branch?: string;
  hasUncommitted: boolean;
  uncommittedFiles: string[];
  unpushedCommitsCount: number;
}

export interface SecretFinding {
  file: string;
  line: number;
  patternName: string;
  description: string;
}

export const SECRET_PATTERNS: Array<{ name: string; regex: RegExp; description: string }> = [
  {
    name: 'AWS Access Key ID',
    regex: /\b(AKIA[0-9A-Z]{16})\b/,
    description: 'Amazon AWS Access Key ID',
  },
  {
    name: 'GitHub Token',
    regex: /\b(gh[pous]_[A-Za-z0-9_]{36,255}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})\b/,
    description: 'GitHub Personal Access Token or OAuth Token',
  },
  {
    name: 'Slack Token',
    regex: /\b(xox[baprs]-[0-9A-Za-z]{10,48})\b/,
    description: 'Slack Bot or User Token',
  },
  {
    name: 'Stripe Secret Key',
    regex: /\b(sk_live_[0-9a-zA-Z]{24,32})\b/,
    description: 'Stripe Live Secret Key',
  },
  {
    name: 'Private Key',
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
    description: 'Unencrypted Private Key Block',
  },
  {
    name: 'Google API Key',
    regex: /\b(AIza[0-9A-Za-z\\-_]{35})\b/,
    description: 'Google API Key',
  },
  {
    name: 'JWT Token',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/,
    description: 'JSON Web Token (JWT)',
  },
];

export async function isGitRepo(cwd: string): Promise<boolean> {
  const result = await execCommand('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
  return result.code === 0 && result.stdout.trim() === 'true';
}

export async function getGitInfo(cwd: string): Promise<GitInfo> {
  const repo = await isGitRepo(cwd);
  if (!repo) {
    return {
      isRepo: false,
      hasUncommitted: false,
      uncommittedFiles: [],
      unpushedCommitsCount: 0,
    };
  }

  // Current branch
  const branchRes = await execCommand('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
  const branch = branchRes.code === 0 ? branchRes.stdout : undefined;

  // Uncommitted status
  const statusRes = await execCommand('git', ['status', '--porcelain'], { cwd });
  const statusLines = statusRes.stdout
    ? statusRes.stdout.split('\n').filter((l) => l.trim().length > 0)
    : [];
  const uncommittedFiles = statusLines.map((l) => l.slice(3).trim());

  // Unpushed commits
  let unpushedCommitsCount = 0;
  if (branch && branch !== 'HEAD') {
    const unpushedRes = await execCommand('git', ['rev-list', `@{u}..HEAD`, '--count'], { cwd });
    if (unpushedRes.code === 0 && unpushedRes.stdout) {
      unpushedCommitsCount = parseInt(unpushedRes.stdout, 10) || 0;
    }
  }

  return {
    isRepo: true,
    branch,
    hasUncommitted: statusLines.length > 0,
    uncommittedFiles,
    unpushedCommitsCount,
  };
}

export async function isFileTrackedByGit(cwd: string, relativePath: string): Promise<boolean> {
  const result = await execCommand('git', ['ls-files', '--error-unmatch', relativePath], { cwd });
  return result.code === 0;
}

export async function isFileIgnoredByGit(cwd: string, relativePath: string): Promise<boolean> {
  const result = await execCommand('git', ['check-ignore', '-q', relativePath], { cwd });
  return result.code === 0;
}

export async function addPatternToGitignore(cwd: string, pattern: string): Promise<boolean> {
  const gitignorePath = path.join(cwd, '.gitignore');
  let content = '';
  try {
    content = await fs.readFile(gitignorePath, 'utf8');
  } catch {
    // File not found, keep empty
  }

  const lines = content.split('\n').map((l) => l.trim());
  if (lines.includes(pattern)) {
    return false; // already present
  }

  const newContent =
    content.endsWith('\n') || content === ''
      ? `${content}${pattern}\n`
      : `${content}\n${pattern}\n`;

  await fs.writeFile(gitignorePath, newContent, 'utf8');
  return true;
}

export async function untrackFile(cwd: string, relativePath: string): Promise<boolean> {
  const res = await execCommand('git', ['rm', '--cached', relativePath], { cwd });
  return res.code === 0;
}

export function scanContentForSecrets(content: string, filePath = ''): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // skip comments in markdown/docs or code comments with mock values
    if (line.includes('example') || line.includes('dummy') || line.includes('placeholder')) {
      continue;
    }

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(line)) {
        findings.push({
          file: filePath,
          line: i + 1,
          patternName: pattern.name,
          description: pattern.description,
        });
      }
    }
  }

  return findings;
}
