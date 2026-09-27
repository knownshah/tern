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
import { agentCommand } from './commands/agent.js';
import { explainCommand } from './commands/explain.js';
import { whyCommand } from './commands/why.js';
import { snapshotCommand } from './commands/snapshot.js';
import { diffCommand } from './commands/diff.js';
import { watchCommand } from './commands/watch.js';

const program = new Command();

program
  .name('tern')
  .description('One command to diagnose your development environment and AI coding setup.')
  .version('0.1.1', '-v, --version', 'Output current Tern version')
  .option('--cwd <path>', 'Specify custom project working directory', process.cwd())
  .option('--verbose', 'Show detailed diagnostic messages', false);

// 1. Doctor command
program
  .command('doctor')
  .description('Scan project health, diagnose environment, lockfiles, env vars, and ports')
  .option('--strict', 'Fail with exit code 1 even on warnings', false)
  .option('--json', 'Output results in JSON format for CI/CD', false)
  .option(
    '--deep',
    'Run heavy diagnostics (dependency audits, remote registries, MCP startups)',
    false
  )
  .action(async (cmdOptions) => {
    try {
      const globalOpts = program.opts();
      const exitCode = await doctorCommand({
        cwd: globalOpts.cwd,
        verbose: globalOpts.verbose,
        strict: cmdOptions.strict,
        json: cmdOptions.json,
        deep: cmdOptions.deep,
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

// 10. Agent command
program
  .command('agent')
  .description(
    'Diagnose AI coding readiness (Codex, Claude Code, Gemini CLI, OpenCode, MCP servers)'
  )
  .option('--json', 'Output machine-readable JSON without decorative output', false)
  .option('--strict', 'Fail with exit code 1 if any warnings or errors are present', false)
  .option('--mcp', 'Run only Model Context Protocol (MCP) server checks', false)
  .option('--deep', 'Run deep startup and timeout validation on MCP servers', false)
  .action(async (cmdOptions) => {
    try {
      const globalOpts = program.opts();
      const exitCode = await agentCommand({
        cwd: globalOpts.cwd,
        json: cmdOptions.json,
        strict: cmdOptions.strict,
        mcp: cmdOptions.mcp,
        deep: cmdOptions.deep,
      });
      process.exit(exitCode);
    } catch (err: any) {
      console.error(chalk.red(`\nFatal: ${err?.message || 'An unexpected error occurred'}`));
      process.exit(1);
    }
  });

// 11. Explain command
program
  .command('explain')
  .description('Explain diagnosed environment issues using AI with sanitized diagnostic metadata')
  .option('--provider <name>', 'Specify AI provider (deepseek, openai, openrouter, ollama)')
  .option('--json', 'Output explanation in JSON format', false)
  .action(async (cmdOptions) => {
    try {
      const globalOpts = program.opts();
      const exitCode = await explainCommand({
        cwd: globalOpts.cwd,
        provider: cmdOptions.provider,
        json: cmdOptions.json,
      });
      process.exit(exitCode);
    } catch (err: any) {
      console.error(chalk.red(`\nFatal: ${err?.message || 'An unexpected error occurred'}`));
      process.exit(1);
    }
  });

// 12. Why command
program
  .command('why <errorMessage>')
  .description(
    'Explain common developer errors locally (EADDRINUSE, ENOENT, detached HEAD, etc.) or with AI'
  )
  .option('--ai', 'Use AI provider if local rules cannot explain the error', false)
  .option('--provider <name>', 'Specify AI provider when using --ai')
  .option('--json', 'Output error analysis in JSON format', false)
  .action(async (errorMessage, cmdOptions) => {
    try {
      const globalOpts = program.opts();
      const exitCode = await whyCommand(errorMessage, {
        cwd: globalOpts.cwd,
        ai: cmdOptions.ai,
        provider: cmdOptions.provider,
        json: cmdOptions.json,
      });
      process.exit(exitCode);
    } catch (err: any) {
      console.error(chalk.red(`\nFatal: ${err?.message || 'An unexpected error occurred'}`));
      process.exit(1);
    }
  });

// 13. Snapshot command
program
  .command('snapshot')
  .description('Capture safe, non-sensitive environment metadata into JSON')
  .option('-o, --output <file>', 'Save snapshot to specified file path')
  .action(async (cmdOptions) => {
    try {
      const globalOpts = program.opts();
      const exitCode = await snapshotCommand({
        cwd: globalOpts.cwd,
        output: cmdOptions.output,
      });
      process.exit(exitCode);
    } catch (err: any) {
      console.error(chalk.red(`\nFatal: ${err?.message || 'An unexpected error occurred'}`));
      process.exit(1);
    }
  });

// 14. Diff command
program
  .command('diff <sourceJson> <targetJson>')
  .description('Compare two environment snapshots to identify VPS vs local mismatches')
  .option('--json', 'Output difference analysis in machine-readable JSON', false)
  .action(async (sourceJson, targetJson, cmdOptions) => {
    try {
      const globalOpts = program.opts();
      const exitCode = await diffCommand(sourceJson, targetJson, {
        cwd: globalOpts.cwd,
        json: cmdOptions.json,
      });
      process.exit(exitCode);
    } catch (err: any) {
      console.error(chalk.red(`\nFatal: ${err?.message || 'An unexpected error occurred'}`));
      process.exit(1);
    }
  });

// 15. Watch command
program
  .command('watch')
  .description(
    'Watch project configs (.env, package.json, MCP configs) and trigger instant checks on changes'
  )
  .option('--debounce <ms>', 'Debounce wait interval in milliseconds', '400')
  .action(async (cmdOptions) => {
    try {
      const globalOpts = program.opts();
      const exitCode = await watchCommand({
        cwd: globalOpts.cwd,
        debounceMs: parseInt(cmdOptions.debounce, 10) || 400,
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
