import chalk from 'chalk';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import { findProcessOnPort, killProcess } from '../utils/ports.js';
import { icons } from '../utils/logger.js';

export interface PortOptions {
  kill?: boolean;
  force?: boolean;
  yes?: boolean;
}

export async function portCommand(
  portArg: string | number,
  options: PortOptions = {}
): Promise<number> {
  const port = typeof portArg === 'string' ? parseInt(portArg, 10) : portArg;

  if (isNaN(port) || port <= 0 || port > 65535) {
    console.error(
      chalk.red(`\nError: Invalid port number "${portArg}". Port must be between 1 and 65535.`)
    );
    return 1;
  }

  console.log(chalk.bold(`\nTern Port Inspector`));
  const spinner = ora(`Inspecting port ${port}...`).start();

  const proc = await findProcessOnPort(port);
  spinner.stop();

  if (!proc) {
    console.log(
      chalk.green(
        `\n${icons.success} Port ${port} is completely free! No active processes listening.\n`
      )
    );
    return 0;
  }

  console.log(chalk.yellow(`\n${icons.warning} Port ${port} is currently in use:`));
  console.log(`  ${chalk.bold('PID:')}          ${proc.pid}`);
  console.log(`  ${chalk.bold('Process:')}      ${proc.name}`);
  if (proc.command && proc.command !== proc.name) {
    console.log(`  ${chalk.bold('Command:')}      ${proc.command}`);
  }
  console.log();

  // Read-only inspect mode by default
  if (!options.kill) {
    console.log(
      chalk.cyan('To terminate this process, run: ') + chalk.bold.cyan(`tern port ${port} --kill\n`)
    );
    return 0;
  }

  let shouldKill = Boolean(options.yes);

  if (!shouldKill) {
    try {
      shouldKill = await confirm({
        message: `Do you want to terminate process ${proc.name} (PID: ${proc.pid}) on port ${port}?`,
        default: false,
      });
    } catch {
      console.log(chalk.dim('\nCancelled.'));
      return 0;
    }
  }

  if (!shouldKill) {
    console.log(chalk.dim('Process left running.\n'));
    return 0;
  }

  const killSpinner = ora(`Terminating PID ${proc.pid}...`).start();
  const res = await killProcess(proc.pid, options.force);

  if (res.success) {
    killSpinner.succeed(
      chalk.green(`Successfully terminated process ${proc.name} (PID: ${proc.pid})!`)
    );
    console.log(chalk.green(`Port ${port} is now free.\n`));
    return 0;
  } else {
    killSpinner.fail(chalk.red(`Failed to terminate PID ${proc.pid}: ${res.error}`));
    console.log(chalk.yellow(`Try running with --force or check process ownership permissions.\n`));
    return 1;
  }
}
