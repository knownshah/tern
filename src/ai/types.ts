export interface DiagnosticIssue {
  severity: 'error' | 'warning' | 'info';
  check: string;
  message: string;
  hint?: string;
}

export interface DiagnosticPayload {
  runtime: {
    node: string;
    platform: string;
    arch?: string;
  };
  project: {
    framework?: string;
    packageManager?: string;
  };
  issues: DiagnosticIssue[];
}

export interface AIProvider {
  id: string;
  name: string;
  isConfigured: () => boolean;
  getMissingConfigInstructions: () => string;
  explainIssues: (payload: DiagnosticPayload) => Promise<string>;
  explainError: (errorMessage: string) => Promise<string>;
}
