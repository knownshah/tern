import { execCommand } from './exec.js';

export interface PortProcess {
  port: number;
  pid: number;
  name: string;
  command?: string;
}

export async function findProcessOnPort(port: number): Promise<PortProcess | null> {
  const isWin = process.platform === 'win32';

  if (isWin) {
    return findProcessOnPortWindows(port);
  } else {
    return findProcessOnPortUnix(port);
  }
}

async function findProcessOnPortUnix(port: number): Promise<PortProcess | null> {
  // Try lsof first
  const lsofRes = await execCommand('lsof', ['-i', `:${port}`, '-sTCP:LISTEN', '-P', '-n']);
  if (lsofRes.code === 0 && lsofRes.stdout) {
    const lines = lsofRes.stdout.split('\n').filter((l) => l.trim().length > 0);
    // line 0 is header: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/\s+/);
      if (parts.length >= 2) {
        const name = parts[0];
        const pid = parseInt(parts[1], 10);
        if (!isNaN(pid)) {
          return { port, pid, name, command: parts[0] };
        }
      }
    }
  }

  // Fallback: ss on Linux
  const ssRes = await execCommand('ss', ['-tulpn', `sport = :${port}`]);
  if (ssRes.code === 0 && ssRes.stdout) {
    // Look for pid=XXXX,name="..."
    const pidMatch = ssRes.stdout.match(/pid=(\d+)/);
    const nameMatch = ssRes.stdout.match(/users:\(\("([^"]+)"/);
    if (pidMatch) {
      const pid = parseInt(pidMatch[1], 10);
      const name = nameMatch ? nameMatch[1] : 'unknown';
      return { port, pid, name };
    }
  }

  // Fallback: fuser
  const fuserRes = await execCommand('fuser', [`${port}/tcp`]);
  if (fuserRes.code === 0 && fuserRes.stdout) {
    const pidMatch = fuserRes.stdout.trim().match(/(\d+)/);
    if (pidMatch) {
      const pid = parseInt(pidMatch[1], 10);
      return { port, pid, name: 'unknown' };
    }
  }

  return null;
}

async function findProcessOnPortWindows(port: number): Promise<PortProcess | null> {
  const netstatRes = await execCommand('netstat', ['-ano', '-p', 'tcp']);
  if (netstatRes.code !== 0 || !netstatRes.stdout) {
    return null;
  }

  const lines = netstatRes.stdout.split('\n');
  const targetPortStr = `:${port}`;

  for (const line of lines) {
    if (line.includes(targetPortStr) && line.includes('LISTENING')) {
      const parts = line.trim().split(/\s+/);
      const pidStr = parts[parts.length - 1];
      const pid = parseInt(pidStr, 10);
      if (!isNaN(pid)) {
        // Query process name
        let name = 'unknown';
        const tasklistRes = await execCommand('tasklist', [
          '/FI',
          `PID eq ${pid}`,
          '/FO',
          'CSV',
          '/NH',
        ]);
        if (tasklistRes.code === 0 && tasklistRes.stdout) {
          const match = tasklistRes.stdout.match(/^"([^"]+)"/);
          if (match) {
            name = match[1];
          }
        }
        return { port, pid, name };
      }
    }
  }

  return null;
}

export async function killProcess(
  pid: number,
  force = false
): Promise<{ success: boolean; error?: string }> {
  try {
    if (process.platform === 'win32') {
      const args = ['/PID', pid.toString(), '/T'];
      if (force) args.push('/F');
      const res = await execCommand('taskkill', args);
      return { success: res.code === 0, error: res.code !== 0 ? res.stderr : undefined };
    } else {
      process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
      return { success: true };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to kill process' };
  }
}
