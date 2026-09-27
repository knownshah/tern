import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { portCommand } from '../../src/commands/port.js';
import * as portsUtil from '../../src/utils/ports.js';
import { confirm } from '@inquirer/prompts';

vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn(),
}));

describe('commands/port', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates invalid port numbers', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitCode = await portCommand('999999');
    errorSpy.mockRestore();

    expect(exitCode).toBe(1);
  });

  it('inspects a free ephemeral port successfully', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitCode = await portCommand(49154);
    logSpy.mockRestore();

    expect(exitCode).toBe(0);
  });

  it('is strictly read-only by default when port is in use and never prompts or kills', async () => {
    vi.spyOn(portsUtil, 'findProcessOnPort').mockResolvedValue({
      port: 3000,
      pid: 12345,
      name: 'node',
      command: 'node server.js',
    });

    const killSpy = vi.spyOn(portsUtil, 'killProcess').mockResolvedValue({ success: true });

    let output = '';
    vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    // Default inspect mode without --kill
    const exitCode = await portCommand(3000);

    expect(exitCode).toBe(0);
    expect(output).toContain('Port 3000 is currently in use');
    expect(output).toContain('PID:          12345');
    expect(output).toContain('Process:      node');
    expect(output).toContain('tern port 3000 --kill');

    // Regression check: NEVER prompted confirm, NEVER called killProcess
    expect(confirm).not.toHaveBeenCalled();
    expect(killSpy).not.toHaveBeenCalled();
  });

  it('prompts confirmation when --kill is specified without --yes', async () => {
    vi.spyOn(portsUtil, 'findProcessOnPort').mockResolvedValue({
      port: 3000,
      pid: 12345,
      name: 'node',
    });

    vi.mocked(confirm).mockResolvedValue(true);
    const killSpy = vi.spyOn(portsUtil, 'killProcess').mockResolvedValue({ success: true });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await portCommand(3000, { kill: true });

    expect(exitCode).toBe(0);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(killSpy).toHaveBeenCalledWith(12345, undefined);
  });

  it('terminates immediately without prompt when --kill --yes is specified', async () => {
    vi.spyOn(portsUtil, 'findProcessOnPort').mockResolvedValue({
      port: 3000,
      pid: 12345,
      name: 'node',
    });

    const killSpy = vi.spyOn(portsUtil, 'killProcess').mockResolvedValue({ success: true });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const exitCode = await portCommand(3000, { kill: true, yes: true });

    expect(exitCode).toBe(0);
    expect(confirm).not.toHaveBeenCalled();
    expect(killSpy).toHaveBeenCalledWith(12345, undefined);
  });
});
