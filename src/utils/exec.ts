import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, type SpawnOptions } from 'node:child_process';

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

export async function execCommand(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {}
): Promise<ExecResult> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, {
        shell: process.platform === 'win32',
        ...options,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        resolve({
          stdout,
          stderr: stderr || err.message,
          code: 1,
        });
      });

      child.on('close', (code) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          code: code ?? 0,
        });
      });
    } catch (err: any) {
      resolve({
        stdout: '',
        stderr: err?.message || 'Failed to spawn process',
        code: 1,
      });
    }
  });
}

export async function execCommandWithTimeout(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {},
  timeoutMs = 5000
): Promise<ExecResult & { timedOut: boolean }> {
  return new Promise((resolve) => {
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;

    try {
      const child = spawn(command, args, {
        shell: process.platform === 'win32',
        ...options,
      });

      let stdout = '';
      let stderr = '';

      timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill('SIGTERM');
        } catch {
          // ignore
        }
      }, timeoutMs);

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        if (timer) clearTimeout(timer);
        resolve({
          stdout,
          stderr: stderr || err.message,
          code: 1,
          timedOut,
        });
      });

      child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        resolve({
          stdout: stdout.trim(),
          stderr: timedOut ? 'Command timed out' : stderr.trim(),
          code: timedOut ? 124 : (code ?? 0),
          timedOut,
        });
      });
    } catch (err: any) {
      if (timer) clearTimeout(timer);
      resolve({
        stdout: '',
        stderr: err?.message || 'Failed to spawn process',
        code: 1,
        timedOut: false,
      });
    }
  });
}

/**
 * Cross-platform executable discovery.
 * Checks whether an executable command exists in PATH or at specified path.
 */
export async function findExecutable(command: string): Promise<string | null> {
  if (!command || typeof command !== 'string') return null;

  const isWin = process.platform === 'win32';
  const hasPathSep = command.includes('/') || (isWin && command.includes('\\'));

  // If path is specified directly
  if (hasPathSep) {
    try {
      await fs.access(command, fs.constants.X_OK);
      return path.resolve(command);
    } catch {
      if (isWin) {
        // Try Windows extensions
        const pathext = (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';');
        for (const ext of pathext) {
          const candidate = `${command}${ext.toLowerCase()}`;
          try {
            await fs.access(candidate);
            return path.resolve(candidate);
          } catch {
            // continue
          }
        }
      }
      return null;
    }
  }

  // Search across PATH directories
  const pathEnv = process.env.PATH || '';
  const delimiter = isWin ? ';' : ':';
  const dirs = pathEnv.split(delimiter).filter(Boolean);

  const extensions = isWin
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').map((e) => e.toLowerCase())
    : [''];

  for (const dir of dirs) {
    for (const ext of extensions) {
      const fullPath = path.join(dir, isWin ? `${command}${ext}` : command);
      try {
        await fs.access(fullPath, isWin ? fs.constants.F_OK : fs.constants.X_OK);
        return fullPath;
      } catch {
        // not found in this directory
      }
    }
  }

  return null;
}
