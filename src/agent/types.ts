import type { MCPScanResult } from '../mcp/types.js';

export type AgentStatus = 'detected' | 'healthy' | 'warning' | 'missing' | 'error';

export interface CodingAgentInfo {
  id: string;
  name: string;
  detected: boolean;
  version?: string;
  configPath?: string;
  status: AgentStatus;
  statusText: string;
  details?: string[];
  issues?: string[];
}

export interface AgentInstructionInfo {
  filename: string;
  path: string;
  exists: boolean;
  sizeBytes?: number;
  status: 'present' | 'missing';
  severity: 'success' | 'warning' | 'info';
  optional?: boolean;
}

export interface AgentDiagnosticReport {
  timestamp: string;
  healthScore: number;
  warningsCount: number;
  errorsCount: number;
  agents: CodingAgentInfo[];
  mcp: MCPScanResult;
  instructions: AgentInstructionInfo[];
}
