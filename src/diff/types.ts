export type DiffSeverity = 'info' | 'warning' | 'blocking';

export interface EnvironmentDifference {
  property: string;
  sourceValue: string;
  targetValue: string;
  severity: DiffSeverity;
  category: 'runtime' | 'env' | 'port' | 'packageManager' | 'os' | 'git' | 'config' | 'ai';
  message?: string;
}

export interface DiffReport {
  sourceName: string;
  targetName: string;
  summary: {
    total: number;
    informational: number;
    warnings: number;
    blocking: number;
  };
  differences: EnvironmentDifference[];
}
