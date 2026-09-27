import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { createContext, runAllChecks } from '../checks/index.js';
import { icons } from '../utils/logger.js';
import type { WatchOptions } from './types.js';

export const WATCHED_FILES = new Set([
  '.env',
  '.env.example',
  '.env.local',
  '.env.production',
  '.env.development',
  'package.json',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lockb',
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  '.cursorrules',
  '.mcp.json',
  'mcp.json',
  'mcp-servers.json',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'vercel.json',
  'netlify.toml',
  '.ternrc.json',
]);

function getTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function isWatchedFile(filename: string): boolean {
  if (!filename) return false;
  const base = path.basename(filename);
  return WATCHED_FILES.has(base) || WATCHED_FILES.has(filename);
}

export async function startWatcher(
  options: WatchOptions = {}
): Promise<{ stop: () => void }> {
  const cwd = options.cwd || process.cwd();
  const debounceMs = options.debounceMs ?? 400;

  console.log(chalk.bold.cyan(`\nTern Watch`));
  console.log(chalk.dim(`Watching ${cwd}\n`));

  let previousIssuesCount = 0;

  // Run initial diagnostic scan
  const initialContext = await createContext(cwd, false, false);
  const initialResults = await runAllChecks(initialContext);
  const initialIssues = initialResults.filter(
    (r) => r.status === 'error' || r.status === 'warning'
  );
  previousIssuesCount = initialIssues.length;

  const time = getTimestamp();
  if (initialIssues.length === 0) {
    console.log(`${time} ${icons.success} Environment healthy`);
  } else {
    for (const issue of initialIssues) {
      const icon = issue.status === 'error' ? icons.error : icons.warning;
      console.log(`${time} ${icon} ${issue.message}`);
    }
  }

  let debounceTimer: NodeJS.Timeout | undefined;
  const changedFilesQueue = new Set<string>();

  const fsWatcher = fs.watch(cwd, { recursive: false }, (eventType, filename) => {
    if (!filename) return;

    if (!isWatchedFile(filename)) {
      return;
    }

    changedFilesQueue.add(path.basename(filename));

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      const files = Array.from(changedFilesQueue);
      changedFilesQueue.clear();

      const eventTime = getTimestamp();
      for (const file of files) {
        console.log(`${eventTime} ${icons.warning} ${file} changed`);
      }
      console.log(`${eventTime} Running relevant checks...`);

      try {
        const scanContext = await createContext(cwd, false, false);
        const results = await runAllChecks(scanContext);
        const currentIssues = results.filter(
          (r) => r.status === 'error' || r.status === 'warning'
        );

        const checkTime = getTimestamp();

        if (currentIssues.length === 0) {
          if (previousIssuesCount > 0) {
            console.log(`${checkTime} ${icons.success} Issue resolved`);
          } else {
            console.log(`${checkTime} ${icons.success} Environment healthy`);
          }
        } else {
          for (const issue of currentIssues) {
            const icon = issue.status === 'error' ? icons.error : icons.warning;
            console.log(`${checkTime} ${icon} ${issue.message}`);
          }
        }

        previousIssuesCount = currentIssues.length;
      } catch (err: any) {
        console.log(`${getTimestamp()} ${icons.error} Error running checks: ${err?.message}`);
      }
    }, debounceMs);
  });

  const stop = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    fsWatcher.close();
  };

  return { stop };
}
