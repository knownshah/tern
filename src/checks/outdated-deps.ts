import type { CheckDefinition, CheckResult, CheckContext } from '../types/index.js';
import { execCommand } from '../utils/exec.js';

export const outdatedDepsCheck: CheckDefinition = {
  id: 'outdated-deps',
  name: 'Dependencies Health & Versions',
  category: 'deps',
  description: 'Checks package dependencies for wildcard versions and outdated packages',
  run: async (context: CheckContext): Promise<CheckResult> => {
    const pkg = context.pkg || {};
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const depNames = Object.keys(deps);

    if (depNames.length === 0) {
      return {
        id: 'outdated-deps',
        name: 'Dependencies Health & Versions',
        category: 'deps',
        status: 'info',
        message: 'No dependencies declared in package.json',
        fixable: false,
      };
    }

    // 1. Check for wildcard or unpinned dangerous versions
    const riskyVersions: string[] = [];
    for (const [name, version] of Object.entries(deps)) {
      const v = String(version).trim();
      if (v === '*' || v === 'latest' || v === '') {
        riskyVersions.push(`${name}: "${v}" (wildcard version may introduce breaking changes)`);
      }
    }

    if (riskyVersions.length > 0) {
      return {
        id: 'outdated-deps',
        name: 'Dependencies Health & Versions',
        category: 'deps',
        status: 'warning',
        message: `${riskyVersions.length} dependency with wildcard/unpinned version`,
        details: riskyVersions,
        fixable: false,
        hint: 'Pin dependency versions to avoid unexpected breaking updates.',
      };
    }

    // 2. Check outdated via package manager (quick check with timeout)
    try {
      // Determine package manager
      let pmCmd = 'npm';
      if (pkg.packageManager?.startsWith('pnpm')) {
        pmCmd = 'pnpm';
      } else if (pkg.packageManager?.startsWith('yarn')) {
        pmCmd = 'yarn';
      }

      // Run outdated with a quick non-blocking check
      const res = await execCommand(pmCmd, ['outdated', '--json'], {
        cwd: context.cwd,
        timeout: 4000,
      });

      if (res.stdout) {
        try {
          const parsed = JSON.parse(res.stdout);
          const outdatedCount = Object.keys(parsed).length;
          if (outdatedCount > 0) {
            const list = Object.keys(parsed)
              .slice(0, 5)
              .map((dep) => {
                const item = parsed[dep];
                return `${dep}: current ${item.current} → latest ${item.latest}`;
              });

            return {
              id: 'outdated-deps',
              name: 'Dependencies Health & Versions',
              category: 'deps',
              status: 'warning',
              message: `${outdatedCount} outdated dependenc${outdatedCount === 1 ? 'y' : 'ies'}`,
              details: list,
              fixable: false,
              hint: `Run '${pmCmd} update' or 'tern deps' to inspect detailed dependency updates.`,
            };
          }
        } catch {
          // If JSON parse fails, ignore
        }
      }
    } catch {
      // Network offline or timeout, continue gracefully
    }

    return {
      id: 'outdated-deps',
      name: 'Dependencies Health & Versions',
      category: 'deps',
      status: 'success',
      message: `Dependencies configured cleanly (${depNames.length} packages)`,
      fixable: false,
    };
  },
};
