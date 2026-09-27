export type CheckStatus = 'success' | 'warning' | 'error' | 'info' | 'skipped';

export type CheckSeverity = 'error' | 'warning' | 'info';

export type CheckCategory =
  | 'node'
  | 'git'
  | 'package'
  | 'env'
  | 'port'
  | 'deploy'
  | 'deps'
  | 'security'
  | 'agent'
  | 'mcp'
  | 'runtime';

export interface FixResult {
  success: boolean;
  message: string;
}

export interface CheckResult {
  id: string;
  name: string;
  category: CheckCategory;
  status: CheckStatus;
  severity?: CheckSeverity;
  message: string;
  details?: string[];
  fixable: boolean;
  fix?: () => Promise<FixResult>;
  hint?: string;
}

export interface TernConfig {
  ignoreChecks?: string[];
  ports?: number[];
  cleanPaths?: string[];
  minNodeVersion?: string;
  strict?: boolean;
  deep?: boolean;
  deploy?: {
    checkLocalhost?: boolean;
    requiredConfigs?: string[];
  };
}

export interface CheckContext {
  cwd: string;
  pkg?: Record<string, any>;
  pkgPath?: string;
  config?: TernConfig;
  verbose?: boolean;
  deep?: boolean;
}

export interface CheckDefinition {
  id: string;
  name: string;
  category: CheckCategory;
  severity?: CheckSeverity;
  description: string;
  deep?: boolean;
  run: (context: CheckContext) => Promise<CheckResult>;
  fix?: (context: CheckContext) => Promise<FixResult>;
}

export interface TernPlugin {
  name: string;
  version?: string;
  description?: string;
  checks?: CheckDefinition[];
}

export interface CategoryHealth {
  category: string;
  percentage: number;
  total: number;
  passed: number;
  warnings: number;
  errors: number;
  applicable: boolean;
}

export interface HealthScore {
  percentage: number;
  total: number;
  passed: number;
  warnings: number;
  errors: number;
  rating: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
  categories?: Record<string, CategoryHealth>;
}
