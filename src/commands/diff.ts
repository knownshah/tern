import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { compareSnapshots } from '../diff/comparator.js';
import { icons } from '../utils/logger.js';
import type { EnvironmentSnapshot } from '../snapshot/types.js';

export interface DiffCommandOptions {
  cwd?: string;
  json?: boolean;
}

function padRight(str: string, length: number): string {
  return str.length >= length ? str : str + ' '.repeat(length - str.length);
}

export async function diffCommand(
  sourcePath: string,
  targetPath: string,
  options: DiffCommandOptions = {}
): Promise<number> {
  const cwd = options.cwd || process.cwd();
  const jsonOutput = Boolean(options.json);

  if (!sourcePath || !targetPath) {
    if (jsonOutput) {
      console.log(
        JSON.stringify(
          {
            error: 'Two snapshot JSON files required. Usage: tern diff <local.json> <server.json>',
          },
          null,
          2
        )
      );
    } else {
      console.error(chalk.red('\nPlease provide two snapshot JSON files to compare.'));
      console.error(chalk.dim('Usage: tern diff <source.json> <target.json>\n'));
    }
    return 1;
  }

  const fullSource = path.isAbsolute(sourcePath) ? sourcePath : path.join(cwd, sourcePath);
  const fullTarget = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);

  let srcData: EnvironmentSnapshot;
  let tgtData: EnvironmentSnapshot;

  try {
    const rawSrc = await fs.readFile(fullSource, 'utf8');
    srcData = JSON.parse(rawSrc);
  } catch (err: any) {
    if (jsonOutput) {
      console.log(JSON.stringify({ error: `Cannot read source file: ${err?.message}` }));
    } else {
      console.error(
        chalk.red(`\nError reading source snapshot: ${fullSource} (${err?.message})\n`)
      );
    }
    return 1;
  }

  try {
    const rawTgt = await fs.readFile(fullTarget, 'utf8');
    tgtData = JSON.parse(rawTgt);
  } catch (err: any) {
    if (jsonOutput) {
      console.log(JSON.stringify({ error: `Cannot read target file: ${err?.message}` }));
    } else {
      console.error(
        chalk.red(`\nError reading target snapshot: ${fullTarget} (${err?.message})\n`)
      );
    }
    return 1;
  }

  const srcName = path.basename(sourcePath, '.json');
  const tgtName = path.basename(targetPath, '.json');
  const report = compareSnapshots(srcData, tgtData, srcName, tgtName);

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    return report.summary.blocking > 0 ? 1 : 0;
  }

  console.log(chalk.bold(`\nEnvironment Differences\n`));

  if (report.differences.length === 0) {
    console.log(chalk.green(`✓ Environments are completely identical.\n`));
    return 0;
  }

  // Header
  console.log(
    `  ${padRight('', 22)} ${padRight(report.sourceName, 16)} ${padRight(report.targetName, 14)}`
  );

  for (const diff of report.differences) {
    let badge = ' ';
    if (diff.severity === 'blocking') {
      badge = icons.error;
    } else if (diff.severity === 'warning') {
      badge = icons.warning;
    }

    const propText = padRight(diff.property, 22);
    const srcVal = padRight(diff.sourceValue, 16);
    const tgtVal = padRight(diff.targetValue, 14);

    let coloredTgt = tgtVal;
    if (diff.severity === 'blocking') {
      coloredTgt = chalk.red(tgtVal);
    } else if (diff.severity === 'warning') {
      coloredTgt = chalk.yellow(tgtVal);
    }

    console.log(`  ${propText} ${chalk.dim(srcVal)} ${coloredTgt} ${badge}`);
  }

  console.log();

  if (report.summary.blocking > 0) {
    console.log(
      chalk.red(
        `✗ Found ${report.summary.blocking} blocking difference(s) that may prevent runtime compatibility.\n`
      )
    );
    return 1;
  }

  if (report.summary.warnings > 0) {
    console.log(
      chalk.yellow(
        `⚠ Found ${report.summary.warnings} warning difference(s). Review recommended.\n`
      )
    );
    return 0;
  }

  return 0;
}
