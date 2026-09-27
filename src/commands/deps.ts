import chalk from 'chalk';
import ora from 'ora';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execCommand } from '../utils/exec.js';
import { icons } from '../utils/logger.js';

export interface DepsOptions {
  cwd?: string;
  fix?: boolean;
}

export async function depsCommand(options: DepsOptions = {}): Promise<number> {
  const cwd = options.cwd || process.cwd();
  console.log(chalk.bold(`\nTern Dependencies Doctor`));

  // 1. Detect package manager
  let pm = 'npm';
  try {
    await fs.access(path.join(cwd, 'pnpm-lock.yaml'));
    pm = 'pnpm';
  } catch {
    try {
      await fs.access(path.join(cwd, 'yarn.lock'));
      pm = 'yarn';
    } catch {
      try {
        await fs.access(path.join(cwd, 'bun.lockb'));
        pm = 'bun';
      } catch {
        // Fallback to npm
      }
    }
  }

  console.log(chalk.dim(`Using package manager: ${pm}\n`));

  // Check 1: Outdated dependencies
  const outdatedSpinner = ora('Checking for outdated packages...').start();
  let outdatedMap: Record<string, any> = {};

  try {
    const res = await execCommand(pm, ['outdated', '--json'], { cwd, timeout: 10000 });
    if (res.stdout) {
      try {
        outdatedMap = JSON.parse(res.stdout);
      } catch {
        // Output might not be JSON or empty
      }
    }
    outdatedSpinner.stop();
  } catch {
    outdatedSpinner.warn(
      chalk.yellow('Could not query outdated packages (offline or registry error)')
    );
  }

  const outdatedEntries = Object.entries(outdatedMap);
  if (outdatedEntries.length === 0) {
    console.log(chalk.green(`${icons.success} All dependencies are up to date!`));
  } else {
    console.log(
      chalk.yellow(`${icons.warning} Found ${outdatedEntries.length} outdated package(s):`)
    );
    for (const [name, info] of outdatedEntries) {
      const current = chalk.red(info.current || 'missing');
      const wanted = chalk.yellow(info.wanted || '?');
      const latest = chalk.green(info.latest || '?');
      console.log(`  ${chalk.bold(name)}: ${current} → wanted ${wanted} → latest ${latest}`);
    }
  }
  console.log();

  // Check 2: Security Audit
  const auditSpinner = ora('Running security vulnerability audit...').start();
  let vulnCount = 0;
  let auditSummary = '';

  try {
    const auditRes = await execCommand(pm, ['audit', '--json'], { cwd, timeout: 15000 });
    auditSpinner.stop();

    if (auditRes.stdout) {
      try {
        const auditData = JSON.parse(auditRes.stdout);
        if (auditData.metadata?.vulnerabilities) {
          const v = auditData.metadata.vulnerabilities;
          vulnCount = (v.low || 0) + (v.moderate || 0) + (v.high || 0) + (v.critical || 0);
          auditSummary = `critical: ${v.critical || 0}, high: ${v.high || 0}, moderate: ${v.moderate || 0}, low: ${v.low || 0}`;
        }
      } catch {
        // yarn or pnpm have slightly different JSON schemas
        if (auditRes.stdout.includes('vulnerabilities')) {
          vulnCount = 1;
        }
      }
    }
  } catch {
    auditSpinner.warn(chalk.yellow('Audit check timed out or was skipped.'));
  }

  if (vulnCount === 0) {
    console.log(
      chalk.green(`${icons.success} No known security vulnerabilities found in dependencies.`)
    );
  } else {
    console.log(chalk.red(`${icons.error} Found security vulnerabilities (${auditSummary}):`));
    console.log(chalk.dim(`  Run "${pm} audit" for full security advisory details.`));
  }

  if (options.fix && (outdatedEntries.length > 0 || vulnCount > 0)) {
    console.log(chalk.cyan(`\nAttempting automatic fix with ${pm}...`));
    const fixSpinner = ora(`Running ${pm} audit fix...`).start();
    const fixRes = await execCommand(pm, ['audit', 'fix'], { cwd });
    if (fixRes.code === 0) {
      fixSpinner.succeed(chalk.green('Audit fix completed!'));
    } else {
      fixSpinner.warn(
        chalk.yellow(`Audit fix finished with notices. Run "${pm} audit" to review.`)
      );
    }
  }

  console.log();
  return vulnCount > 0 ? 1 : 0;
}
