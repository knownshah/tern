import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { collectEnvironmentSnapshot } from '../snapshot/collector.js';

export interface SnapshotCommandOptions {
  cwd?: string;
  output?: string;
}

export async function snapshotCommand(options: SnapshotCommandOptions = {}): Promise<number> {
  const cwd = options.cwd || process.cwd();
  const isFileOutput = Boolean(options.output);

  const spinner = isFileOutput
    ? ora({
        text: 'Collecting non-sensitive environment snapshot...',
        color: 'cyan',
      }).start()
    : null;

  try {
    const snapshot = await collectEnvironmentSnapshot({ cwd });
    spinner?.stop();

    const formatted = JSON.stringify(snapshot, null, 2);

    if (options.output) {
      const targetPath = path.isAbsolute(options.output)
        ? options.output
        : path.join(cwd, options.output);
      await fs.writeFile(targetPath, formatted, 'utf8');
      console.log(chalk.green(`\n✓ Environment snapshot saved to ${chalk.bold(targetPath)}\n`));
    } else {
      console.log(formatted);
    }

    return 0;
  } catch (err: any) {
    spinner?.stop();
    console.error(chalk.red(`\nFailed to create snapshot: ${err?.message || 'Unknown error'}\n`));
    return 1;
  }
}
