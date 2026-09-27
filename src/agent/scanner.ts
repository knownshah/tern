import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'os';
import { findExecutable, execCommandWithTimeout } from '../utils/exec.js';
import { scanMCPServers } from '../mcp/scanner.js';
import type {
  CodingAgentInfo,
  AgentInstructionInfo,
  AgentDiagnosticReport,
} from './types.js';

export interface AgentScanOptions {
  cwd?: string;
  deep?: boolean;
  mcpOnly?: boolean;
}

async function fileOrDirExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getAgentVersion(
  cmdName: string,
  args: string[] = ['--version']
): Promise<string | undefined> {
  try {
    const res = await execCommandWithTimeout(cmdName, args, {}, 2500);
    if (res.code === 0 && res.stdout) {
      const match = res.stdout.match(/(\d+\.\d+\.\S*|\d+\.\d+\.\d+)/);
      return match ? match[1] : res.stdout.split('\n')[0].trim().slice(0, 20);
    }
  } catch {
    // ignore
  }
  return undefined;
}

export async function scanAgentEnvironment(
  options: AgentScanOptions = {}
): Promise<AgentDiagnosticReport> {
  const cwd = options.cwd || process.cwd();
  const home = os.homedir();
  const deep = Boolean(options.deep);
  const mcpOnly = Boolean(options.mcpOnly);

  // 1. Scan MCP Servers
  const mcpResult = await scanMCPServers({ cwd, deep });

  // 2. Scan Coding Agents
  const agents: CodingAgentInfo[] = [];

  if (!mcpOnly) {
    // --- Codex ---
    const codexBin = await findExecutable('codex');
    const codexConfigGlobal = path.join(home, '.codex');
    const codexConfigLocal = path.join(cwd, '.codex');
    const hasCodexConfig =
      (await fileOrDirExists(codexConfigGlobal)) || (await fileOrDirExists(codexConfigLocal));
    const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY);

    if (codexBin) {
      const ver = await getAgentVersion('codex');
      agents.push({
        id: 'codex',
        name: 'Codex',
        detected: true,
        version: ver || '0.x.x',
        status: 'healthy',
        statusText: ver || '0.x.x',
        details: [hasOpenAIKey ? 'OPENAI_API_KEY: configured' : 'OPENAI_API_KEY: missing'],
      });
    } else if (hasCodexConfig) {
      agents.push({
        id: 'codex',
        name: 'Codex',
        detected: true,
        status: 'healthy',
        statusText: 'detected',
        details: [hasOpenAIKey ? 'OPENAI_API_KEY: configured' : 'OPENAI_API_KEY: missing'],
      });
    } else {
      agents.push({
        id: 'codex',
        name: 'Codex',
        detected: false,
        status: 'missing',
        statusText: 'not installed',
      });
    }

    // --- Claude Code ---
    const claudeBin = await findExecutable('claude');
    const claudeConfigGlobal = path.join(home, '.claude');
    const claudeConfigLocal = path.join(cwd, '.claude');
    const claudeJson = path.join(home, '.claude.json');
    const hasClaudeConfig =
      (await fileOrDirExists(claudeConfigGlobal)) ||
      (await fileOrDirExists(claudeConfigLocal)) ||
      (await fileOrDirExists(claudeJson));

    if (claudeBin) {
      const ver = await getAgentVersion('claude');
      agents.push({
        id: 'claude-code',
        name: 'Claude Code',
        detected: true,
        version: ver,
        status: 'healthy',
        statusText: ver || 'detected',
      });
    } else if (hasClaudeConfig) {
      agents.push({
        id: 'claude-code',
        name: 'Claude Code',
        detected: true,
        status: 'healthy',
        statusText: 'detected',
      });
    } else {
      agents.push({
        id: 'claude-code',
        name: 'Claude Code',
        detected: false,
        status: 'missing',
        statusText: 'not installed',
      });
    }

    // --- Gemini CLI ---
    const geminiBin = await findExecutable('gemini');
    const geminiConfigGlobal = path.join(home, '.gemini');
    const hasGeminiConfig = await fileOrDirExists(geminiConfigGlobal);

    if (geminiBin) {
      const ver = await getAgentVersion('gemini');
      agents.push({
        id: 'gemini-cli',
        name: 'Gemini CLI',
        detected: true,
        version: ver,
        status: 'healthy',
        statusText: ver || 'detected',
      });
    } else if (hasGeminiConfig) {
      agents.push({
        id: 'gemini-cli',
        name: 'Gemini CLI',
        detected: true,
        status: 'healthy',
        statusText: 'detected',
      });
    } else {
      agents.push({
        id: 'gemini-cli',
        name: 'Gemini CLI',
        detected: false,
        status: 'missing',
        statusText: 'not installed',
      });
    }

    // --- OpenCode ---
    const opencodeBin = await findExecutable('opencode');
    const opencodeConfigGlobal = path.join(home, '.config', 'opencode');
    const opencodeConfigLocal = path.join(cwd, '.opencode');
    const hasOpencodeConfig =
      (await fileOrDirExists(opencodeConfigGlobal)) ||
      (await fileOrDirExists(opencodeConfigLocal));

    let opencodeStatus: CodingAgentInfo['status'] = 'missing';
    let opencodeText = 'not installed';
    const opencodeIssues: string[] = [];

    if (opencodeBin) {
      const ver = await getAgentVersion('opencode');
      opencodeStatus = 'healthy';
      opencodeText = ver || 'detected';
    } else if (hasOpencodeConfig) {
      // Check if config has invalid syntax
      const testJson = path.join(opencodeConfigGlobal, 'config.json');
      let configValid = true;
      try {
        const raw = await fs.readFile(testJson, 'utf8');
        JSON.parse(raw);
      } catch {
        // If file exists but invalid JSON, flag config issue
        if (await fileOrDirExists(testJson)) {
          configValid = false;
        }
      }

      if (!configValid) {
        opencodeStatus = 'warning';
        opencodeText = 'configuration issue';
        opencodeIssues.push('malformed config.json in ~/.config/opencode/');
      } else {
        opencodeStatus = 'healthy';
        opencodeText = 'detected';
      }
    }

    agents.push({
      id: 'opencode',
      name: 'OpenCode',
      detected: opencodeBin !== null || hasOpencodeConfig,
      status: opencodeStatus,
      statusText: opencodeText,
      issues: opencodeIssues.length > 0 ? opencodeIssues : undefined,
    });
  }

  // 3. Scan Agent Instruction Files in cwd
  const instructionFiles = [
    'AGENTS.md',
    'CLAUDE.md',
    'GEMINI.md',
    '.cursorrules',
    '.github/copilot-instructions.md',
  ];

  const claudeAgent = agents.find((a) => a.id === 'claude-code');
  const isClaudeDetected = Boolean(claudeAgent?.detected);
  const hasLocalGemini =
    (await fileOrDirExists(path.join(cwd, '.gemini'))) ||
    (await fileOrDirExists(path.join(cwd, 'gemini.config.json')));

  const instructions: AgentInstructionInfo[] = [];

  for (const filename of instructionFiles) {
    const fullPath = path.join(cwd, filename);
    try {
      const stats = await fs.stat(fullPath);
      instructions.push({
        filename,
        path: fullPath,
        exists: true,
        sizeBytes: stats.size,
        status: 'present',
        severity: 'success',
        optional: false,
      });
    } catch {
      // Only report standard files (AGENTS.md, CLAUDE.md, GEMINI.md) as candidates
      if (['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'].includes(filename)) {
        let severity: 'warning' | 'info' = 'info';
        let optional = true;

        if (filename === 'CLAUDE.md' && isClaudeDetected) {
          severity = 'warning';
          optional = false;
        } else if (filename === 'GEMINI.md' && hasLocalGemini) {
          severity = 'warning';
          optional = false;
        }

        instructions.push({
          filename,
          path: fullPath,
          exists: false,
          status: 'missing',
          severity,
          optional,
        });
      }
    }
  }

  // 4. Calculate health score and issues
  let warningsCount = 0;
  let errorsCount = 0;

  // MCP issues
  errorsCount += mcpResult.errorCount;
  warningsCount += mcpResult.warningCount;

  // Agent issues
  if (!mcpOnly) {
    for (const agent of agents) {
      if (agent.status === 'warning') warningsCount++;
      if (agent.status === 'error') errorsCount++;
    }

    // Only count instructions that are actually warnings
    for (const inst of instructions) {
      if (inst.severity === 'warning') {
        warningsCount++;
      }
    }
  }

  // Health Score algorithm:
  // Base 100%. Deduct 20% per error, 6% per warning.
  // Floor at 0%, capped at 100%.
  const deductions = errorsCount * 20 + warningsCount * 6;
  let healthScore = Math.max(0, Math.min(100, 100 - deductions));

  if (errorsCount === 0 && warningsCount === 0) {
    healthScore = 100;
  } else if (errorsCount > 0 && healthScore > 85) {
    healthScore = 85;
  }

  return {
    timestamp: new Date().toISOString(),
    healthScore,
    warningsCount,
    errorsCount,
    agents,
    mcp: mcpResult,
    instructions,
  };
}
