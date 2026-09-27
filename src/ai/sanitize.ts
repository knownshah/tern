import os from 'os';
import { redactSecrets } from '../utils/redact.js';
import type { CheckResult, CheckContext } from '../types/index.js';
import type { DiagnosticPayload, DiagnosticIssue } from './types.js';

export function buildSanitizedDiagnosticPayload(
  results: CheckResult[],
  context?: CheckContext
): DiagnosticPayload {
  const issues: DiagnosticIssue[] = [];

  for (const r of results) {
    if (r.status === 'error' || r.status === 'warning') {
      issues.push({
        severity: r.status,
        check: r.category,
        message: redactSecrets(r.message),
        hint: r.hint ? redactSecrets(r.hint) : undefined,
      });
    }
  }

  let framework: string | undefined;
  if (context?.pkg) {
    const deps = { ...context.pkg.dependencies, ...context.pkg.devDependencies };
    if (deps['next']) framework = 'nextjs';
    else if (deps['nuxt']) framework = 'nuxt';
    else if (deps['vite']) framework = 'vite';
    else if (deps['express']) framework = 'express';
    else if (deps['@nestjs/core']) framework = 'nestjs';
    else if (deps['astro']) framework = 'astro';
    else if (deps['@remix-run/react']) framework = 'remix';
  }

  let packageManager = 'npm';
  if (context?.pkg?.packageManager) {
    packageManager = context.pkg.packageManager.split('@')[0];
  }

  return {
    runtime: {
      node: process.version.replace(/^v/, ''),
      platform: os.platform(),
      arch: os.arch(),
    },
    project: {
      framework,
      packageManager,
    },
    issues,
  };
}
