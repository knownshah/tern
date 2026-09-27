import { describe, it, expect, vi } from 'vitest';
import { whyCommand } from '../../src/commands/why.js';
import { hasAnsiCodes } from '../helpers/ansi.js';

describe('commands/why', () => {
  it('explains EADDRINUSE error with detected port and recommended fix', async () => {
    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const exitCode = await whyCommand('Error: listen EADDRINUSE: address already in use :::3000');

    consoleSpy.mockRestore();

    expect(output).toContain('EADDRINUSE');
    expect(output).toContain('Another process is already using port 3000');
    expect(output).toContain('tern port 3000 --kill');
    expect(exitCode).toBe(0);
  });

  it('explains MODULE_NOT_FOUND error with package name', async () => {
    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const exitCode = await whyCommand("Error: Cannot find module 'express'");

    consoleSpy.mockRestore();

    expect(output).toContain('MODULE_NOT_FOUND');
    expect(output).toContain('express');
    expect(output).toContain('pnpm install express');
    expect(exitCode).toBe(0);
  });

  it('explains TypeScript TS2304 error correctly', async () => {
    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const exitCode = await whyCommand("error TS2304: Cannot find name 'document'");

    consoleSpy.mockRestore();

    expect(output).toContain('TS2304');
    expect(output).toContain('Cannot find name');
    expect(exitCode).toBe(0);
  });

  it('outputs strictly valid single JSON document with --json flag without ANSI codes', async () => {
    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const exitCode = await whyCommand('ENOENT: no such file or directory, open package.json', {
      json: true,
    });

    consoleSpy.mockRestore();

    // Verify raw stdout is pure JSON without ANSI escape sequences
    expect(hasAnsiCodes(output)).toBe(false);

    const parsed = JSON.parse(output.trim());
    expect(parsed.matched).toBe(true);
    expect(parsed.ruleId).toBe('ENOENT');
    expect(parsed).toHaveProperty('title');
    expect(parsed).toHaveProperty('meaning');
    expect(parsed).toHaveProperty('suggestedFix');
    expect(exitCode).toBe(0);
  });
});
