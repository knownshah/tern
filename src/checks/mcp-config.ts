import { scanMCPServers } from '../mcp/scanner.js';
import type { CheckDefinition, CheckResult, CheckContext } from '../types/index.js';

export const mcpConfigCheck: CheckDefinition = {
  id: 'mcp-config',
  name: 'MCP Server Configurations',
  category: 'mcp',
  description: 'Verifies Model Context Protocol (MCP) server definitions and executables',
  run: async (context: CheckContext): Promise<CheckResult> => {
    const isDeep = Boolean(context.deep);
    const mcpScan = await scanMCPServers({
      cwd: context.cwd,
      deep: isDeep,
    });

    if (mcpScan.configFilesFound.length === 0 && mcpScan.totalServers === 0) {
      return {
        id: 'mcp-config',
        name: 'MCP Server Configurations',
        category: 'mcp',
        status: 'info',
        message: 'No MCP server configurations detected',
        fixable: false,
      };
    }

    if (mcpScan.malformedConfigs.length > 0) {
      return {
        id: 'mcp-config',
        name: 'MCP Server Configurations',
        category: 'mcp',
        status: 'error',
        message: `Found ${mcpScan.malformedConfigs.length} malformed MCP config file(s)`,
        details: mcpScan.malformedConfigs.map((m) => `${m.path}: ${m.error}`),
        fixable: false,
      };
    }

    if (mcpScan.errorCount > 0) {
      const errServers = mcpScan.servers.filter((s) => s.status === 'error');
      return {
        id: 'mcp-config',
        name: 'MCP Server Configurations',
        category: 'mcp',
        status: 'error',
        message: `MCP configuration issue: ${errServers.map((s) => `${s.name} (${s.message})`).join(', ')}`,
        details: errServers.flatMap((s) => s.issues),
        fixable: false,
        hint: 'Run "tern agent --mcp" for detailed MCP server diagnostics.',
      };
    }

    if (mcpScan.warningCount > 0) {
      const warnServers = mcpScan.servers.filter((s) => s.status === 'warning');
      return {
        id: 'mcp-config',
        name: 'MCP Server Configurations',
        category: 'mcp',
        status: 'warning',
        message: `MCP warnings: ${warnServers.map((s) => `${s.name} (${s.message})`).join(', ')}`,
        details: warnServers.flatMap((s) => s.issues),
        fixable: false,
        hint: 'Run "tern agent --mcp" to inspect environment variable requirements.',
      };
    }

    return {
      id: 'mcp-config',
      name: 'MCP Server Configurations',
      category: 'mcp',
      status: 'success',
      message: `${mcpScan.healthyCount} MCP server(s) healthy and verified`,
      fixable: false,
    };
  },
};
