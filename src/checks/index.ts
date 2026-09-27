import fs from 'node:fs/promises';
import path from 'node:path';
import type { CheckDefinition, CheckResult, CheckContext } from '../types/index.js';
import { loadConfig } from '../utils/config.js';

import { nodeVersionCheck } from './node-version.js';
import { packageManagerCheck } from './package-manager.js';
import { gitStatusCheck } from './git-status.js';
import { packageJsonCheck } from './package-json.js';
import { envFilesCheck } from './env-files.js';
import { gitEnvTrackedCheck } from './git-env-tracked.js';
import { portConflictsCheck } from './port-conflicts.js';
import { deployConfigCheck } from './deploy-config.js';
import { outdatedDepsCheck } from './outdated-deps.js';

export const ALL_CHECKS: CheckDefinition[] = [
  nodeVersionCheck,
  packageManagerCheck,
  gitStatusCheck,
  packageJsonCheck,
  outdatedDepsCheck,
  envFilesCheck,
  gitEnvTrackedCheck,
  portConflictsCheck,
  deployConfigCheck,
];

export async function createContext(cwd: string, verbose = false): Promise<CheckContext> {
  const config = await loadConfig(cwd);
  const pkgPath = path.join(cwd, 'package.json');
  let pkg: Record<string, any> | undefined;

  try {
    const raw = await fs.readFile(pkgPath, 'utf8');
    pkg = JSON.parse(raw);
  } catch {
    pkg = undefined;
  }

  return {
    cwd,
    pkg,
    pkgPath,
    config,
    verbose,
  };
}

export async function runAllChecks(
  context: CheckContext,
  onProgress?: (check: CheckDefinition) => void
): Promise<CheckResult[]> {
  const ignored = new Set(context.config?.ignoreChecks || []);
  const results: CheckResult[] = [];

  for (const check of ALL_CHECKS) {
    if (ignored.has(check.id)) {
      results.push({
        id: check.id,
        name: check.name,
        category: check.category,
        status: 'skipped',
        message: `Skipped via configuration: ${check.name}`,
        fixable: false,
      });
      continue;
    }

    if (onProgress) {
      onProgress(check);
    }

    try {
      const result = await check.run(context);
      results.push(result);
    } catch (err: any) {
      results.push({
        id: check.id,
        name: check.name,
        category: check.category,
        status: 'error',
        message: `Check failed unexpectedly: ${err?.message || 'Unknown error'}`,
        fixable: false,
      });
    }
  }

  return results;
}
