import fs from 'node:fs/promises';
import { getCandidateMCPLocations } from './locations.js';
import { findExecutable, execCommandWithTimeout } from '../utils/exec.js';
import { sanitizeEnvRecord } from '../utils/redact.js';
import type {
  MCPServerDiagnostic,
  MCPScanResult,
  MCPTransportType,
  MCPServerRawConfig,
} from './types.js';

export interface MCPScanOptions {
  cwd?: string;
  deep?: boolean;
  timeoutMs?: number;
}

/**
 * Scans for MCP servers across project and OS-aware locations.
 */
export async function scanMCPServers(options: MCPScanOptions = {}): Promise<MCPScanResult> {
  const cwd = options.cwd || process.cwd();
  const deep = Boolean(options.deep);
  const timeoutMs = options.timeoutMs ?? 2000;

  const candidateLocations = getCandidateMCPLocations(cwd);
  const seenPaths = new Set<string>();
  const configFilesFound: string[] = [];
  const malformedConfigs: Array<{ path: string; error: string }> = [];

  const rawServers: Array<{
    name: string;
    configFile: string;
    config: MCPServerRawConfig;
  }> = [];

  const serverNameCounts = new Map<string, number>();

  for (const loc of candidateLocations) {
    if (seenPaths.has(loc.path)) continue;
    seenPaths.add(loc.path);

    let content: string;
    try {
      content = await fs.readFile(loc.path, 'utf8');
    } catch {
      continue; // File does not exist or unreadable
    }

    configFilesFound.push(loc.path);

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (err: any) {
      malformedConfigs.push({
        path: loc.path,
        error: `JSON parse error: ${err?.message || 'Invalid JSON'}`,
      });
      continue;
    }

    if (!parsed || typeof parsed !== 'object') {
      malformedConfigs.push({
        path: loc.path,
        error: 'Configuration must be a JSON object',
      });
      continue;
    }

    // Extract servers from various config formats:
    // Format 1: { mcpServers: { [name]: config } }
    // Format 2: { servers: { [name]: config } }
    // Format 3: Array of servers [ { name, ... } ]
    let serverMap: Record<string, MCPServerRawConfig> | undefined;

    if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
      serverMap = parsed.mcpServers;
    } else if (parsed.servers && typeof parsed.servers === 'object') {
      serverMap = parsed.servers;
    } else if (Array.isArray(parsed)) {
      serverMap = {};
      for (const item of parsed) {
        if (item && typeof item === 'object' && item.name) {
          serverMap[item.name] = item;
        }
      }
    }

    if (serverMap) {
      for (const [name, serverConfig] of Object.entries(serverMap)) {
        if (serverConfig && typeof serverConfig === 'object') {
          rawServers.push({
            name,
            configFile: loc.path,
            config: serverConfig,
          });
          serverNameCounts.set(name, (serverNameCounts.get(name) || 0) + 1);
        }
      }
    }
  }

  const serverDiagnostics: MCPServerDiagnostic[] = [];
  const processedNames = new Set<string>();

  for (const { name, configFile, config } of rawServers) {
    const isDuplicate = (serverNameCounts.get(name) || 0) > 1;
    // If we've already processed this server name from a higher priority config, mark duplicate
    const alreadyProcessed = processedNames.has(name);
    processedNames.add(name);

    const issues: string[] = [];
    const missingEnvVars: string[] = [];

    // 1. Determine transport
    let transport: MCPTransportType = 'unknown';
    if (config.transport) {
      transport = config.transport as MCPTransportType;
    } else if (config.command) {
      transport = 'stdio';
    } else if (config.url) {
      if (config.url.startsWith('ws://') || config.url.startsWith('wss://')) {
        transport = 'websocket';
      } else {
        transport = 'sse';
      }
    }

    // 2. Check malformed config
    let malformed = false;
    if (!config.command && !config.url) {
      malformed = true;
      issues.push('missing command or url');
    }

    // 3. Inspect and sanitize environment variables (NEVER EXPOSE VALUES)
    const envStatus: Record<string, 'configured' | 'missing'> = {};

    if (config.env && typeof config.env === 'object') {
      const sanitized = sanitizeEnvRecord(config.env);
      Object.assign(envStatus, sanitized);

      // Check for environment references like ${VAR} or empty configured values
      for (const [key, val] of Object.entries(config.env)) {
        if (typeof val === 'string') {
          const varMatch = val.match(/^\$\{?([A-Za-z0-9_]+)\}?$/);
          if (varMatch) {
            const refName = varMatch[1];
            const systemVal = process.env[refName];
            if (!systemVal || systemVal.trim().length === 0) {
              missingEnvVars.push(refName);
              envStatus[key] = 'missing';
              issues.push(`environment variable ${refName} is not set in environment`);
            } else {
              envStatus[key] = 'configured';
            }
          }
        }
      }
    }

    // 4. Executable validation for stdio transport
    let executableFound = false;
    let executablePath: string | null = null;
    let isTimeout = false;

    if (config.command) {
      executablePath = await findExecutable(config.command);
      executableFound = executablePath !== null;

      if (!executableFound) {
        issues.push('command not found');
      } else if (deep) {
        // Deep startup check with timeout
        try {
          const testRes = await execCommandWithTimeout(
            config.command,
            config.args?.slice(0, 1) || ['--help'],
            {
              env: {
                ...process.env,
                ...(config.env || {}),
              },
            },
            timeoutMs
          );

          if (testRes.timedOut) {
            isTimeout = true;
            issues.push('timeout');
          }
        } catch {
          // ignore exec errors in deep check
        }
      }
    } else if (config.url) {
      // URL based server (SSE / HTTP)
      executableFound = true;
    }

    if (alreadyProcessed || isDuplicate) {
      issues.push(`duplicate server definition '${name}'`);
    }

    // 5. Determine overall status
    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    let message = 'healthy';

    if (malformed) {
      status = 'error';
      message = 'malformed configuration';
    } else if (config.command && !executableFound) {
      status = 'error';
      message = 'command not found';
    } else if (isTimeout) {
      status = 'warning';
      message = 'timeout';
    } else if (missingEnvVars.length > 0) {
      status = 'warning';
      message = `missing env: ${missingEnvVars.join(', ')}`;
    } else if (alreadyProcessed || isDuplicate) {
      status = 'warning';
      message = 'duplicate definition';
    }

    serverDiagnostics.push({
      name,
      configFile,
      transport,
      command: config.command,
      executablePath,
      executableFound,
      status,
      message,
      issues,
      envStatus,
      missingEnvVars,
      duplicate: isDuplicate,
      malformed,
      timeout: isTimeout,
    });
  }

  const healthyCount = serverDiagnostics.filter((s) => s.status === 'healthy').length;
  const warningCount =
    serverDiagnostics.filter((s) => s.status === 'warning').length + malformedConfigs.length;
  const errorCount = serverDiagnostics.filter((s) => s.status === 'error').length;

  return {
    totalServers: serverDiagnostics.length,
    healthyCount,
    warningCount,
    errorCount,
    servers: serverDiagnostics,
    configFilesFound,
    malformedConfigs,
  };
}
