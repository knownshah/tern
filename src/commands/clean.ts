import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import { loadConfig } from '../utils/config.js';
import { icons } from '../utils/logger.js';

export interface CleanOptions {
  cwd?: string;
  all?: boolean;
  yes?: boolean;
  dryRun?: boolean;
}

interface TargetPath {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
}

async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += await getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        totalSize += stat.size;
      }
    }
  } catch {
    // Ignore permissions or missing items
  }
  return totalSize;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export async function cleanCommand(options: CleanOptions = {}): Promise<number> {
  const cwd = options.cwd || process.cwd();
  const config = await loadConfig(cwd);

  const candidatePaths = [...(config.cleanPaths || [])];
  if (options.all) {
    candidatePaths.push('node_modules');
  }

  console.log(chalk.bold(`\nTern Workspace Cleaner`));
  const spinner = ora('Scanning for cache and build artifacts...').start();

  const foundTargets: TargetPath[] = [];

  for (const rel of candidatePaths) {
    const abs = path.join(cwd, rel);
    try {
      const stat = await fs.stat(abs);
      const sizeBytes = stat.isDirectory() ? await getDirectorySize(abs) : stat.size;
      foundTargets.push({
        relativePath: rel,
        absolutePath: abs,
        sizeBytes,
      });
    } catch {
      // Path does not exist, ignore
    }
  }

  spinner.stop();

  if (foundTargets.length === 0) {
    console.log(
      chalk.green(
        `\n${icons.success} Workspace is already clean! No build artifacts or caches found.\n`
      )
    );
    return 0;
  }

  const totalBytes = foundTargets.reduce((acc, t) => acc + t.sizeBytes, 0);

  console.log(
    chalk.yellow(`\nFound ${foundTargets.length} cleanable target(s) (${formatBytes(totalBytes)}):`)
  );
  foundTargets.forEach((t, i) => {
    console.log(
      `  ${chalk.bold(`${i + 1}.`)} ${t.relativePath} ${chalk.dim(`(${formatBytes(t.sizeBytes)})`)}`
    );
  });
  console.log();

  if (options.dryRun) {
    console.log(
      chalk.cyan(
        `[Dry Run] Would reclaim approximately ${formatBytes(totalBytes)} of disk space.\n`
      )
    );
    return 0;
  }

  let shouldDelete = options.yes;
  if (!shouldDelete) {
    try {
      shouldDelete = await confirm({
        message: `Are you sure you want to permanently delete these ${foundTargets.length} target(s)?`,
        default: true,
      });
    } catch {
      console.log(chalk.dim('\nClean cancelled.'));
      return 0;
    }
  }

  if (!shouldDelete) {
    console.log(chalk.yellow('Clean cancelled. No files were removed.\n'));
    return 0;
  }

  const delSpinner = ora('Deleting artifacts...').start();
  let deletedCount = 0;

  for (const t of foundTargets) {
    try {
      await fs.rm(t.absolutePath, { recursive: true, force: true });
      deletedCount++;
    } catch (err: any) {
      console.error(chalk.red(`\nFailed to delete ${t.relativePath}: ${err?.message}`));
    }
  }

  delSpinner.succeed(
    chalk.green(
      `Clean complete! Removed ${deletedCount} item(s) and reclaimed ${formatBytes(totalBytes)} of disk space.\n`
    )
  );

  return 0;
}
