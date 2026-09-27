import chalk from 'chalk';
import ora from 'ora';
import { createContext, runAllChecks } from '../checks/index.js';
import { formatCheckResult, formatHealthScore } from '../utils/logger.js';
import { calculateHealthScore } from '../utils/health.js';
import type { CheckResult } from '../types/index.js';

export interface DoctorOptions {
  cwd?: string;
  verbose?: boolean;
  strict?: boolean;
  json?: boolean;
  deep?: boolean;
}

export async function doctorCommand(options: DoctorOptions = {}): Promise<number> {
  const cwd = options.cwd || process.cwd();
  const verbose = Boolean(options.verbose);
  const strict = Boolean(options.strict);
  const jsonOutput = Boolean(options.json);
  const deep = Boolean(options.deep);

  const context = await createContext(cwd, verbose, deep);

  if (!jsonOutput) {
    console.log(chalk.bold(`\nTern v0.1.0`));
  }

  const spinner = !jsonOutput
    ? ora({
        text: 'Scanning project...',
        color: 'cyan',
      }).start()
    : null;

  const results: CheckResult[] = [];

  try {
    const checkResults = await runAllChecks(context, (check) => {
      if (spinner) {
        spinner.text = `Scanning: ${check.name}...`;
      }
    });
    results.push(...checkResults);
  } finally {
    spinner?.stop();
  }

  const score = calculateHealthScore(results);

  if (jsonOutput) {
    const output = {
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      health: score,
      results: results.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
        status: r.status,
        message: r.message,
        details: r.details,
        fixable: r.fixable,
        hint: r.hint,
      })),
    };
    console.log(JSON.stringify(output, null, 2));
    if (score.errors > 0 || (strict && score.warnings > 0)) {
      return 1;
    }
    return 0;
  }

  // Print list of check results
  console.log();
  for (const res of results) {
    console.log(formatCheckResult(res, verbose));
  }

  console.log();
  console.log(formatHealthScore(score));

  const fixableCount = results.filter(
    (r) => r.fixable && (r.status === 'error' || r.status === 'warning')
  ).length;
  if (fixableCount > 0) {
    console.log(
      chalk.cyan(`\nRun `) +
        chalk.bold.cyan(`tern fix`) +
        chalk.cyan(` to resolve ${fixableCount} safe issue(s) automatically.`)
    );
  }

  console.log();

  if (score.errors > 0) {
    return 1;
  }

  if (strict && score.warnings > 0) {
    return 1;
  }

  return 0;
}
