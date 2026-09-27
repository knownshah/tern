import os from 'os';
import path from 'node:path';

export interface MCPConfigLocation {
  tool: string;
  scope: 'project' | 'global';
  path: string;
}

/**
 * Returns candidate MCP configuration file locations for the given OS and working directory.
 */
export function getCandidateMCPLocations(
  cwd: string = process.cwd(),
  platform: NodeJS.Platform = process.platform
): MCPConfigLocation[] {
  const home = os.homedir();
  const locations: MCPConfigLocation[] = [];

  // 1. Project-level locations
  const projectCandidates: Array<{ tool: string; file: string }> = [
    { tool: 'Standard MCP', file: '.mcp.json' },
    { tool: 'Standard MCP', file: 'mcp.json' },
    { tool: 'Standard MCP', file: 'mcp-servers.json' },
    { tool: 'Claude Code', file: path.join('.claude', 'mcp.json') },
    { tool: 'Claude Code', file: '.claude.json' },
    { tool: 'Claude Code', file: 'claude.json' },
    { tool: 'Cursor', file: path.join('.cursor', 'mcp.json') },
    { tool: 'VSCode', file: path.join('.vscode', 'mcp.json') },
    { tool: 'OpenCode', file: path.join('.opencode', 'mcp.json') },
    { tool: 'OpenCode', file: 'opencode.json' },
    { tool: 'Tern', file: path.join('.tern', 'mcp.json') },
  ];

  for (const item of projectCandidates) {
    locations.push({
      tool: item.tool,
      scope: 'project',
      path: path.join(cwd, item.file),
    });
  }

  // 2. Global / OS-specific locations
  if (platform === 'darwin') {
    const appSupport = path.join(home, 'Library', 'Application Support');
    locations.push(
      {
        tool: 'Claude Desktop',
        scope: 'global',
        path: path.join(appSupport, 'Claude', 'claude_desktop_config.json'),
      },
      {
        tool: 'Cline',
        scope: 'global',
        path: path.join(
          appSupport,
          'Code',
          'User',
          'globalStorage',
          'saoudrizwan.claude-dev',
          'settings',
          'cline_mcp_settings.json'
        ),
      },
      {
        tool: 'Roo Code',
        scope: 'global',
        path: path.join(
          appSupport,
          'Code',
          'User',
          'globalStorage',
          'rooveterinaryinc.roo-cline',
          'settings',
          'cline_mcp_settings.json'
        ),
      }
    );
  } else if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    locations.push(
      {
        tool: 'Claude Desktop',
        scope: 'global',
        path: path.join(appData, 'Claude', 'claude_desktop_config.json'),
      },
      {
        tool: 'Cline',
        scope: 'global',
        path: path.join(
          appData,
          'Code',
          'User',
          'globalStorage',
          'saoudrizwan.claude-dev',
          'settings',
          'cline_mcp_settings.json'
        ),
      },
      {
        tool: 'Roo Code',
        scope: 'global',
        path: path.join(
          appData,
          'Code',
          'User',
          'globalStorage',
          'rooveterinaryinc.roo-cline',
          'settings',
          'cline_mcp_settings.json'
        ),
      }
    );
  } else {
    // Linux and others
    const configDir = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    locations.push(
      {
        tool: 'Claude Desktop',
        scope: 'global',
        path: path.join(configDir, 'Claude', 'claude_desktop_config.json'),
      },
      {
        tool: 'Claude Desktop',
        scope: 'global',
        path: path.join(home, '.claude', 'claude_desktop_config.json'),
      },
      {
        tool: 'Cline',
        scope: 'global',
        path: path.join(
          configDir,
          'Code',
          'User',
          'globalStorage',
          'saoudrizwan.claude-dev',
          'settings',
          'cline_mcp_settings.json'
        ),
      },
      {
        tool: 'Roo Code',
        scope: 'global',
        path: path.join(
          configDir,
          'Code',
          'User',
          'globalStorage',
          'rooveterinaryinc.roo-cline',
          'settings',
          'cline_mcp_settings.json'
        ),
      },
      {
        tool: 'OpenCode',
        scope: 'global',
        path: path.join(configDir, 'opencode', 'mcp.json'),
      }
    );
  }

  // Cross-platform user home locations
  locations.push(
    {
      tool: 'Claude Code',
      scope: 'global',
      path: path.join(home, '.claude.json'),
    },
    {
      tool: 'Claude Code',
      scope: 'global',
      path: path.join(home, '.claude', 'mcp.json'),
    },
    {
      tool: 'Cursor',
      scope: 'global',
      path: path.join(home, '.cursor', 'mcp.json'),
    },
    {
      tool: 'Gemini CLI',
      scope: 'global',
      path: path.join(home, '.gemini', 'antigravity-cli', 'mcp.json'),
    },
    {
      tool: 'Gemini CLI',
      scope: 'global',
      path: path.join(home, '.gemini', 'settings.json'),
    }
  );

  return locations;
}
