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
