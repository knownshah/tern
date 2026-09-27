import chalk from 'chalk';
import { startWatcher } from '../watch/watcher.js';

export interface WatchCommandOptions {
  cwd?: string;
  debounceMs?: number;
}

export async function watchCommand(options: WatchCommandOptions = {}): Promise<number> {
  const cwd = options.cwd || process.cwd();

  const watcher = await startWatcher({ cwd, debounceMs: options.debounceMs });

  return new Promise<number>((resolve) => {
    const handleSigint = () => {
      console.log(chalk.dim('\nStopping Tern Watch...'));
      watcher.stop();
      process.off('SIGINT', handleSigint);
      process.off('SIGTERM', handleSigint);
      resolve(0);
    };

    process.on('SIGINT', handleSigint);
    process.on('SIGTERM', handleSigint);
  });
}
