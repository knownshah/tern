import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDir, type TestDirectory } from '../helpers/test-dir.js';
import { agentCommand } from '../../src/commands/agent.js';
import { hasAnsiCodes } from '../helpers/ansi.js';

describe('commands/agent', () => {
  let testDir: TestDirectory;

  beforeEach(async () => {
    testDir = await createTestDir();
  });

  afterEach(async () => {
    await testDir.cleanup();
  });

  it('runs agent command and outputs strictly valid single JSON document without ANSI or prefix', async () => {
    await testDir.writeFile('AGENTS.md', '# Agents');
    await testDir.writeFile('CLAUDE.md', '# Claude');

    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const exitCode = await agentCommand({
      cwd: testDir.path,
      json: true,
    });

    consoleSpy.mockRestore();

    // Verify raw stdout is pure JSON without ANSI escape sequences
    expect(hasAnsiCodes(output)).toBe(false);

    // Equivalent to jq . / JSON.parse() on entire stdout
    const parsed = JSON.parse(output.trim());
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('healthScore');
    expect(parsed).toHaveProperty('warningsCount');
    expect(parsed).toHaveProperty('errorsCount');
    expect(parsed.agents).toBeInstanceOf(Array);
    expect(parsed.mcp).toHaveProperty('servers');
    expect(parsed.instructions).toBeInstanceOf(Array);
    expect(parsed.instructions.some((i: any) => i.filename === 'AGENTS.md' && i.exists)).toBe(true);
    expect(exitCode).toBe(0);
  });

  it('treats missing instruction files as optional info when tools are not detected without deducting health', async () => {
    // Empty directory, no agent instruction files present
    let jsonOutput = '';
    const consoleJsonSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      jsonOutput += String(msg) + '\n';
    });

    const exitCodeJson = await agentCommand({
      cwd: testDir.path,
      json: true,
    });

    consoleJsonSpy.mockRestore();
    expect(exitCodeJson).toBe(0);

    const report = JSON.parse(jsonOutput.trim());
    const claudeInst = report.instructions.find((i: any) => i.filename === 'CLAUDE.md');
    const geminiInst = report.instructions.find((i: any) => i.filename === 'GEMINI.md');
    const agentsInst = report.instructions.find((i: any) => i.filename === 'AGENTS.md');

    // Missing instructions should be optional/info, not warning
    if (claudeInst && !claudeInst.exists) {
      expect(claudeInst.severity).toBe('info');
      expect(claudeInst.optional).toBe(true);
    }
    if (geminiInst && !geminiInst.exists) {
      expect(geminiInst.severity).toBe('info');
      expect(geminiInst.optional).toBe(true);
    }
    if (agentsInst && !agentsInst.exists) {
      expect(agentsInst.severity).toBe('info');
      expect(agentsInst.optional).toBe(true);
    }

    // Missing optional instructions should NOT increment warningsCount or lower health score
    expect(report.warningsCount).toBe(0);
    expect(report.errorsCount).toBe(0);
    expect(report.healthScore).toBe(100);

    // Now test terminal formatting: warning symbol count must match report.warningsCount exactly
    let termOutput = '';
    const consoleTermSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      termOutput += String(msg) + '\n';
    });

    await agentCommand({
      cwd: testDir.path,
    });

    consoleTermSpy.mockRestore();

    // Counts the warning symbols (⚠) in the output
    const warningSymbols = (termOutput.match(/⚠/g) || []).length;
    expect(warningSymbols).toBe(report.warningsCount);
    expect(termOutput).toContain('missing (optional)');
  });

  it('honors --strict flag: passes when warnings=0, fails when warnings or errors exist', async () => {
    // Clean environment with no issues
    const consoleSpy1 = vi.spyOn(console, 'log').mockImplementation(() => {});
    const cleanExit = await agentCommand({
      cwd: testDir.path,
      strict: true,
      json: true,
    });
    consoleSpy1.mockRestore();
    expect(cleanExit).toBe(0);

    // Environment with malformed MCP config creating error/warning
    await testDir.writeFile('.mcp.json', '{ invalid json syntax');

    let output = '';
    const consoleSpy2 = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const strictFailExit = await agentCommand({
      cwd: testDir.path,
      strict: true,
      json: true,
    });

    consoleSpy2.mockRestore();

    const parsed = JSON.parse(output.trim());
    expect(parsed.warningsCount).toBeGreaterThan(0);
    expect(strictFailExit).toBe(1);
  });

  it('supports --mcp flag to focus exclusively on MCP servers', async () => {
    await testDir.writeFile(
      '.mcp.json',
      JSON.stringify({
        mcpServers: {
          test_fs: {
            command: 'node',
            args: ['-e', 'process.exit(0)'],
          },
        },
      })
    );

    let output = '';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
      output += String(msg) + '\n';
    });

    const exitCode = await agentCommand({
      cwd: testDir.path,
      mcp: true,
    });

    consoleSpy.mockRestore();

    expect(output).toContain('MCP Servers');
    expect(output).not.toContain('Coding Agents');
    expect(output).toContain('test_fs');
    expect(exitCode).toBe(0);
  });
});
