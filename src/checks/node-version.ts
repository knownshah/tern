import fs from 'node:fs/promises';
import path from 'node:path';
import semver from 'semver';
import type { CheckDefinition, CheckResult, CheckContext } from '../types/index.js';

export const nodeVersionCheck: CheckDefinition = {
  id: 'node-version',
  name: 'Node.js Version',
  category: 'node',
  description:
    'Verifies current Node.js version satisfies project requirements (engines or >=18.0.0)',
  run: async (context: CheckContext): Promise<CheckResult> => {
    const currentVersion = process.version;
    const cleanCurrent = semver.clean(currentVersion) || currentVersion;

    let targetRange = context.config?.minNodeVersion || '>=18.0.0';
    let source = 'default';

    // 1. Check package.json engines.node
    if (context.pkg?.engines?.node) {
      targetRange = context.pkg.engines.node;
      source = 'package.json engines';
    } else {
      // 2. Check .nvmrc
      try {
        const nvmrcPath = path.join(context.cwd, '.nvmrc');
        const nvmrc = (await fs.readFile(nvmrcPath, 'utf8')).trim();
        if (nvmrc) {
          const semverCandidate = semver.coerce(nvmrc);
          if (semverCandidate) {
            targetRange = `>=${semverCandidate.version}`;
            source = '.nvmrc';
          }
        }
      } catch {
        // No .nvmrc, check .node-version
        try {
          const nvPath = path.join(context.cwd, '.node-version');
          const nv = (await fs.readFile(nvPath, 'utf8')).trim();
          if (nv) {
            const semverCandidate = semver.coerce(nv);
            if (semverCandidate) {
              targetRange = `>=${semverCandidate.version}`;
              source = '.node-version';
            }
          }
        } catch {
          // Use default
        }
      }
    }

    const satisfies = semver.satisfies(cleanCurrent, targetRange, { loose: true });

    if (satisfies) {
      return {
        id: 'node-version',
        name: 'Node.js Version',
        category: 'node',
        status: 'success',
        message: `Node.js ${currentVersion} (satisfies ${targetRange} from ${source})`,
        fixable: false,
      };
    }

    return {
      id: 'node-version',
      name: 'Node.js Version',
      category: 'node',
      status: 'error',
      message: `Node.js ${currentVersion} does not satisfy ${targetRange} (required by ${source})`,
      details: [
        `Current: ${currentVersion}`,
        `Required: ${targetRange}`,
        `Consider switching version with 'nvm use' or 'fnm use'`,
      ],
      fixable: false,
      hint: `Install the supported Node.js version using your version manager (nvm, fnm, or volta).`,
    };
  },
};
