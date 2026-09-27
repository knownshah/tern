export interface EnvironmentSnapshot {
  schemaVersion: '1.0.0';
  timestamp: string;
  os: {
    platform: string;
    type: string;
    release: string;
    arch: string;
  };
  runtime: {
    node: string;
  };
  packageManager: {
    name: string;
    version?: string;
  };
  git: {
    installed: boolean;
    version?: string;
    isRepo: boolean;
    branch?: string;
  };
  project: {
    name?: string;
    version?: string;
    framework?: string;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  environment: {
    // Only key names, strictly no values
    keysPresent: string[];
    hasEnvExample: boolean;
    hasEnv: boolean;
  };
  ports: Array<{
    port: number;
    status: 'free' | 'occupied';
    process?: string;
  }>;
  aiAgents: Array<{
    id: string;
    name: string;
    detected: boolean;
    version?: string;
  }>;
  configs: {
    hasPackageJson: boolean;
    hasTsConfig: boolean;
    hasDockerfile: boolean;
    hasDockerCompose: boolean;
    hasVercelJson: boolean;
    hasNetlifyToml: boolean;
    hasMcpConfig: boolean;
    hasAgentInstructions: boolean;
  };
}
