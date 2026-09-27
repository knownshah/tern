import chalk from 'chalk';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import { createContext, runAllChecks } from '../checks/index.js';
import { icons } from '../utils/logger.js';

export interface FixOptions {
  cwd?: string;
  yes?: boolean;
}

export async function fixCommand(options: FixOptions = {}): Promise<number> {
  const cwd = options.cwd || process.cwd();
  const autoConfirm = Boolean(options.yes);

  console.log(chalk.bold(`\nTern Auto-Fix`));

  const spinner = ora('Scanning for fixable issues...').start();
  const context = await createContext(cwd, false);
  const results = await runAllChecks(context);
  spinner.stop();

  const fixableResults = results.filter(
    (r) =>
      r.fixable && (r.status === 'error' || r.status === 'warning') && typeof r.fix === 'function'
  );

  if (fixableResults.length === 0) {
    console.log(
      chalk.green(`\n${icons.success} No auto-fixable issues detected! Everything looks good.`)
    );
    return 0;
  }

  console.log(chalk.yellow(`\nFound ${fixableResults.length} fixable issue(s):`));
  fixableResults.forEach((r, idx) => {
    console.log(`  ${chalk.bold(`${idx + 1}.`)} ${r.name}: ${chalk.dim(r.message)}`);
  });
  console.log();

  let shouldProceed = autoConfirm;
  if (!autoConfirm) {
    try {
      shouldProceed = await confirm({
        message: `Do you want Tern to apply these fixes?`,
        default: true,
      });
    } catch {
      console.log(chalk.dim('\nAborted.'));
      return 1;
    }
  }

  if (!shouldProceed) {
    console.log(chalk.yellow('Fix cancelled. No changes were made.'));
    return 0;
  }

  console.log(chalk.cyan('\nApplying fixes...'));
  let successCount = 0;
  let failCount = 0;

  for (const item of fixableResults) {
    const fixSpinner = ora(`Fixing: ${item.name}...`).start();
    try {
      const fixResult = await item.fix!();
      if (fixResult.success) {
        fixSpinner.succeed(chalk.green(`${item.name}: ${fixResult.message}`));
        successCount++;
      } else {
        fixSpinner.fail(chalk.red(`${item.name}: ${fixResult.message}`));
        failCount++;
      }
    } catch (err: any) {
      fixSpinner.fail(chalk.red(`${item.name}: ${err?.message || 'Failed'}`));
      failCount++;
    }
  }

  console.log();
  if (failCount === 0) {
    console.log(chalk.green.bold(`✓ Successfully applied all ${successCount} fix(es)!`));
    console.log(chalk.dim('Run "tern doctor" to verify your updated project health.\n'));
    return 0;
  } else {
    console.log(
      chalk.yellow.bold(
        `⚠ Applied ${successCount} fix(es), but ${failCount} failed. Check output above.\n`
      )
    );
    return 1;
  }
}
