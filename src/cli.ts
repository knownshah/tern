#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';

import { doctorCommand } from './commands/doctor.js';
import { fixCommand } from './commands/fix.js';
import { envCommand } from './commands/env.js';
import { portCommand } from './commands/port.js';
import { cleanCommand } from './commands/clean.js';
import { depsCommand } from './commands/deps.js';
import { gitCommand } from './commands/git.js';
import { deployCommand } from './commands/deploy.js';
import { reportCommand } from './commands/report.js';

const program = new Command();

program
  .name('tern')
  .description('One command to diagnose your development environment.')
  .version('0.1.0', '-v, --version', 'Output current Tern version')
  .option('--cwd <path>', 'Specify custom project working directory', process.cwd())
  .option('--verbose', 'Show detailed diagnostic messages', false);

// 1. Doctor command
program
  .command('doctor')
  .description('Scan project health, diagnose environment, lockfiles, env vars, and ports')
  .option('--strict', 'Fail with exit code 1 even on warnings', false)
  .option('--json', 'Output results in JSON format for CI/CD', false)
  .action(async (cmdOptions) => {
    try {
      const globalOpts = program.opts();
      const exitCode = await doctorCommand({
        cwd: globalOpts.cwd,
        verbose: globalOpts.verbose,
        strict: cmdOptions.strict,
        json: cmdOptions.json,
      });
      process.exit(exitCode);
    } catch (err: any) {
      console.error(chalk.red(`\nFatal: ${err?.message || 'An unexpected error occurred'}`));
      if (program.opts().verbose && err?.stack) {
        console.error(chalk.dim(err.stack));
      }
      process.exit(1);
    }
  });

// 2. Fix command
program
  .command('fix')
  .description(
    'Automatically resolve safe issues (add .env to .gitignore, install missing deps, etc.)'
  )
  .option('-y, --yes', 'Skip interactive confirmation prompt (ideal for CI)', false)
  .action(async (cmdOptions) => {
    try {
      const globalOpts = program.opts();
      const exitCode = await fixCommand({
        cwd: globalOpts.cwd,
        yes: cmdOptions.yes,
      });
      process.exit(exitCode);
    } catch (err: any) {
      console.error(chalk.red(`\nFatal: ${err?.message || 'An unexpected error occurred'}`));
      process.exit(1);
    }
  });

// 3. Env command
program
  .command('env')
  .description('Compare .env against .env.example without leaking secrets')
  .option('--example <file>', 'Template env filename', '.env.example')
  .option('--env <file>', 'Target local env filename', '.env')
  .option('--sync', 'Append missing placeholder keys into local .env', false)
  .action(async (cmdOptions) => {
    try {
      const globalOpts = program.opts();
      const exitCode = await envCommand({
        cwd: globalOpts.cwd,
        example: cmdOptions.example,
        env: cmdOptions.env,
        sync: cmdOptions.sync,
      });
      process.exit(exitCode);
    } catch (err: any) {
      console.error(chalk.red(`\nFatal: ${err?.message || 'An unexpected error occurred'}`));
      process.exit(1);
    }
  });

// 4. Port command
program
  .command('port <number>')
  .description('Inspect processes using a specific port and optionally terminate them')
  .option('-k, --kill', 'Terminate process using the port', false)
  .option('-f, --force', 'Forcefully kill process (SIGKILL / taskkill /F)', false)
  .option('-y, --yes', 'Skip confirmation prompt when killing', false)
  .action(async (portArg, cmdOptions) => {
    try {
      const exitCode = await portCommand(portArg, {
        kill: cmdOptions.kill,
        force: cmdOptions.force,
        yes: cmdOptions.yes,
      });
      process.exit(exitCode);
    } catch (err: any) {
      console.error(chalk.red(`\nFatal: ${err?.message || 'An unexpected error occurred'}`));
      process.exit(1);
    }
  });

// 5. Clean command
program
  .command('clean')
  .description('Delete common build caches and artifacts (node_modules/.cache, dist, .next, etc.)')
  .option('-a, --all', 'Include node_modules root directory in cleanup', false)
  .option('-y, --yes', 'Skip confirmation prompt', false)
  .option('--dry-run', 'Calculate reclaimable space without deleting anything', false)
  .action(async (cmdOptions) => {
    try {
      const globalOpts = program.opts();
      const exitCode = await cleanCommand({
        cwd: globalOpts.cwd,
        all: cmdOptions.all,
        yes: cmdOptions.yes,
        dryRun: cmdOptions.dryRun,
      });
      process.exit(exitCode);
    } catch (err: any) {
      console.error(chalk.red(`\nFatal: ${err?.message || 'An unexpected error occurred'}`));
      process.exit(1);
    }
  });

// 6. Deps command
program
  .command('deps')
  .description('Inspect outdated and vulnerable dependencies')
  .option('--fix', 'Attempt automated vulnerability fix via package manager', false)
  .action(async (cmdOptions) => {
    try {
      const globalOpts = program.opts();
      const exitCode = await depsCommand({
        cwd: globalOpts.cwd,
        fix: cmdOptions.fix,
      });
      process.exit(exitCode);
    } catch (err: any) {
      console.error(chalk.red(`\nFatal: ${err?.message || 'An unexpected error occurred'}`));
      process.exit(1);
    }
  });

// 7. Git command
program
  .command('git')
  .description('Check working tree status, unpushed commits, and scan for leaked secrets')
  .action(async () => {
    try {
      const globalOpts = program.opts();
      const exitCode = await gitCommand({
        cwd: globalOpts.cwd,
      });
      process.exit(exitCode);
    } catch (err: any) {
      console.error(chalk.red(`\nFatal: ${err?.message || 'An unexpected error occurred'}`));
      process.exit(1);
    }
  });

// 8. Deploy command
program
  .command('deploy')
  .description(
    'Verify deployment readiness (build script, platform configs, production env safety)'
  )
  .action(async () => {
    try {
      const globalOpts = program.opts();
      const exitCode = await deployCommand({
        cwd: globalOpts.cwd,
      });
      process.exit(exitCode);
    } catch (err: any) {
      console.error(chalk.red(`\nFatal: ${err?.message || 'An unexpected error occurred'}`));
      process.exit(1);
    }
  });

// 9. Report command
program
  .command('report')
  .description('Generate markdown diagnostics report ready to paste into GitHub Issues')
  .option('-o, --output <file>', 'Save markdown report to specified file path')
  .action(async (cmdOptions) => {
    try {
      const globalOpts = program.opts();
      const exitCode = await reportCommand({
        cwd: globalOpts.cwd,
        output: cmdOptions.output,
      });
      process.exit(exitCode);
    } catch (err: any) {
      console.error(chalk.red(`\nFatal: ${err?.message || 'An unexpected error occurred'}`));
      process.exit(1);
    }
  });

// Default to doctor if no command specified
if (process.argv.length <= 2) {
  process.argv.push('doctor');
}

program.parse(process.argv);
