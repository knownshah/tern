export type CheckStatus = 'success' | 'warning' | 'error' | 'info' | 'skipped';

export type CheckCategory =
  'node' | 'git' | 'package' | 'env' | 'port' | 'deploy' | 'deps' | 'security';

export interface FixResult {
  success: boolean;
  message: string;
}

export interface CheckResult {
  id: string;
  name: string;
  category: CheckCategory;
  status: CheckStatus;
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
}

export interface CheckDefinition {
  id: string;
  name: string;
  category: CheckCategory;
  description: string;
  run: (context: CheckContext) => Promise<CheckResult>;
}

export interface HealthScore {
  percentage: number;
  total: number;
  passed: number;
  warnings: number;
  errors: number;
  rating: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
}
