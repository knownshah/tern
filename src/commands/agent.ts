import chalk from 'chalk';
import ora from 'ora';
import { scanAgentEnvironment } from '../agent/scanner.js';
import { icons } from '../utils/logger.js';
import type { AgentDiagnosticReport } from '../agent/types.js';

export interface AgentCommandOptions {
  cwd?: string;
  json?: boolean;
  strict?: boolean;
  mcp?: boolean;
  deep?: boolean;
}

function padRight(str: string, length: number): string {
  return str.length >= length ? str : str + ' '.repeat(length - str.length);
}

export async function agentCommand(options: AgentCommandOptions = {}): Promise<number> {
  const cwd = options.cwd || process.cwd();
  const jsonOutput = Boolean(options.json);
  const strict = Boolean(options.strict);
  const mcpOnly = Boolean(options.mcp);
  const deep = Boolean(options.deep);

  const spinner = !jsonOutput
    ? ora({
        text: mcpOnly ? 'Diagnosing MCP servers...' : 'Diagnosing AI coding environment...',
        color: 'cyan',
      }).start()
    : null;

  let report: AgentDiagnosticReport;
  try {
    report = await scanAgentEnvironment({ cwd, deep, mcpOnly });
  } finally {
    spinner?.stop();
  }

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
    if (strict && (report.warningsCount > 0 || report.errorsCount > 0)) {
      return 1;
    }
    return report.errorsCount > 0 ? 1 : 0;
  }

  console.log(chalk.bold(`\nAI Development Environment\n`));

  // 1. Coding Agents Section (unless --mcp)
  if (!mcpOnly && report.agents.length > 0) {
    console.log(chalk.bold('Coding Agents'));
    for (const agent of report.agents) {
      let icon = icons.skipped;
      let text = chalk.dim(agent.statusText);

      if (agent.status === 'healthy') {
        icon = icons.success;
        text = chalk.white(agent.statusText);
      } else if (agent.status === 'warning') {
        icon = icons.warning;
        text = chalk.yellow(agent.statusText);
      } else if (agent.status === 'error') {
        icon = icons.error;
        text = chalk.red(agent.statusText);
      }

      console.log(`  ${icon} ${padRight(agent.name, 18)} ${text}`);
    }
    console.log();
  }

  // 2. MCP Servers Section
  console.log(chalk.bold('MCP Servers'));
  if (report.mcp.servers.length === 0) {
    console.log(`  ${icons.skipped} ${chalk.dim('No MCP servers configured')}`);
  } else {
    for (const server of report.mcp.servers) {
      let icon = icons.success;
      let text = chalk.white(server.message);

      if (server.status === 'warning') {
        icon = icons.warning;
        text = chalk.yellow(server.message);
      } else if (server.status === 'error') {
        icon = icons.error;
        text = chalk.red(server.message);
      }

      console.log(`  ${icon} ${padRight(server.name, 18)} ${text}`);
    }
  }

  if (report.mcp.malformedConfigs.length > 0) {
    for (const malformed of report.mcp.malformedConfigs) {
      console.log(
        `  ${icons.warning} ${padRight('Malformed Config', 18)} ${chalk.yellow(malformed.path)}`
      );
    }
  }
  console.log();

  // 3. Agent Instructions Section (unless --mcp)
  if (!mcpOnly && report.instructions.length > 0) {
    console.log(chalk.bold('Agent Instructions'));
    for (const inst of report.instructions) {
      if (inst.exists) {
        console.log(`  ${icons.success} ${inst.filename}`);
      } else if (inst.severity === 'warning') {
        console.log(`  ${icons.warning} ${inst.filename} missing`);
      } else {
        console.log(`  ${icons.info} ${chalk.dim(`${inst.filename} missing (optional)`)}`);
      }
    }
    console.log();
  }

  // 4. Agent Health Score
  let scoreColor = chalk.green;
  if (report.healthScore < 50) {
    scoreColor = chalk.red;
  } else if (report.healthScore < 80) {
    scoreColor = chalk.yellow;
  }

  console.log(chalk.bold(`Agent Health: `) + scoreColor.bold(`${report.healthScore}%`));
  console.log();

  // 5. Summary line
  if (report.warningsCount === 0 && report.errorsCount === 0) {
    console.log(chalk.green(`✓ All AI coding environment checks passed.\n`));
  } else {
    const parts: string[] = [];
    if (report.warningsCount > 0) {
      parts.push(chalk.yellow(`${report.warningsCount} warning${report.warningsCount > 1 ? 's' : ''}`));
    }
    if (report.errorsCount > 0) {
      parts.push(chalk.red(`${report.errorsCount} error${report.errorsCount > 1 ? 's' : ''}`));
    }
    console.log(parts.join(' · ') + '\n');
  }

  if (strict && (report.warningsCount > 0 || report.errorsCount > 0)) {
    return 1;
  }

  return report.errorsCount > 0 ? 1 : 0;
}
