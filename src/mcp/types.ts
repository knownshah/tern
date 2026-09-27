export type MCPTransportType = 'stdio' | 'sse' | 'websocket' | 'http' | 'unknown';

export type MCPServerStatus = 'healthy' | 'warning' | 'error';

export interface MCPServerRawConfig {
  command?: string;
  args?: string[];
  url?: string;
  transport?: string;
  env?: Record<string, string>;
  disabled?: boolean;
  autoApprove?: string[];
  [key: string]: any;
}

export interface MCPServerDefinition {
  name: string;
  configFile: string;
  transport: MCPTransportType;
  command?: string;
  args?: string[];
  url?: string;
  envKeys: string[];
  rawEnv?: Record<string, string>;
}

export interface MCPServerDiagnostic {
  name: string;
  configFile: string;
  transport: MCPTransportType;
  command?: string;
  executablePath?: string | null;
  executableFound: boolean;
  status: MCPServerStatus;
  message: string;
  issues: string[];
  // Sanitized environment map: ONLY 'configured' | 'missing', NEVER values
  envStatus: Record<string, 'configured' | 'missing'>;
  missingEnvVars: string[];
  duplicate: boolean;
  malformed: boolean;
  timeout?: boolean;
}

export interface MCPScanResult {
  totalServers: number;
  healthyCount: number;
  warningCount: number;
  errorCount: number;
  servers: MCPServerDiagnostic[];
  configFilesFound: string[];
  malformedConfigs: Array<{ path: string; error: string }>;
}
