import fs from 'node:fs/promises';
import path from 'node:path';
import type { CheckDefinition, CheckResult, CheckContext, FixResult } from '../types/index.js';

interface LockfileInfo {
  name: string;
  pm: string;
  exists: boolean;
}

export const packageManagerCheck: CheckDefinition = {
  id: 'package-manager',
  name: 'Package Manager & Lockfile',
  category: 'package',
  description: 'Detects active package manager and checks for conflicting lockfiles',
  run: async (context: CheckContext): Promise<CheckResult> => {
    const lockfiles: LockfileInfo[] = [
      { name: 'pnpm-lock.yaml', pm: 'pnpm', exists: false },
      { name: 'package-lock.json', pm: 'npm', exists: false },
      { name: 'yarn.lock', pm: 'yarn', exists: false },
      { name: 'bun.lockb', pm: 'bun', exists: false },
      { name: 'bun.lock', pm: 'bun', exists: false },
    ];

    for (const lf of lockfiles) {
      try {
        await fs.access(path.join(context.cwd, lf.name));
        lf.exists = true;
      } catch {
        lf.exists = false;
      }
    }

    const presentLockfiles = lockfiles.filter((lf) => lf.exists);
    const declaredPm = context.pkg?.packageManager as string | undefined;

    if (presentLockfiles.length === 0 && !declaredPm) {
      return {
        id: 'package-manager',
        name: 'Package Manager & Lockfile',
        category: 'package',
        status: 'warning',
        message: 'No lockfile found (pnpm-lock.yaml, package-lock.json, yarn.lock, bun.lock)',
        details: ['A lockfile ensures deterministic builds across machines and CI/CD pipelines.'],
        fixable: false,
        hint: 'Run your package manager install command (e.g., npm install, pnpm install).',
      };
    }

    // Check for conflicting lockfiles
    const uniquePMs = Array.from(new Set(presentLockfiles.map((l) => l.pm)));
    if (uniquePMs.length > 1) {
      const lockfileNames = presentLockfiles.map((l) => l.name);
      const primaryPM = declaredPm ? declaredPm.split('@')[0] : uniquePMs[0];
      const redundantLockfiles = presentLockfiles.filter((l) => l.pm !== primaryPM);

      return {
        id: 'package-manager',
        name: 'Package Manager & Lockfile',
        category: 'package',
        status: 'warning',
        message: `Conflicting lockfiles detected: ${lockfileNames.join(', ')}`,
        details: [
          `Detected multiple package manager lockfiles (${uniquePMs.join(', ')}).`,
          `This can cause version mismatches and unpredictable build results.`,
          `Primary detected package manager: ${primaryPM}`,
        ],
        fixable: redundantLockfiles.length > 0,
        fix: async (): Promise<FixResult> => {
          try {
            const removed: string[] = [];
            for (const r of redundantLockfiles) {
              await fs.unlink(path.join(context.cwd, r.name));
              removed.push(r.name);
            }
            return {
              success: true,
              message: `Removed redundant lockfiles: ${removed.join(', ')}`,
            };
          } catch (err: any) {
            return {
              success: false,
              message: `Failed to remove conflicting lockfiles: ${err?.message}`,
            };
          }
        },
        hint: `Keep only ${primaryPM}'s lockfile and remove the others.`,
      };
    }

    const activePM = declaredPm || (presentLockfiles[0] ? presentLockfiles[0].pm : 'npm');
    return {
      id: 'package-manager',
      name: 'Package Manager & Lockfile',
      category: 'package',
      status: 'success',
      message: `Package manager: ${activePM} (${presentLockfiles.map((l) => l.name).join(', ') || 'configured'})`,
      fixable: false,
    };
  },
};
