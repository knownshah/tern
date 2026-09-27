import { describe, it, expect, vi } from 'vitest';
import { portCommand } from '../../src/commands/port.js';

describe('commands/port', () => {
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
});
