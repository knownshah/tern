import fs from 'node:fs/promises';
import path from 'node:path';
import type { TernConfig } from '../types/index.js';

const CONFIG_FILENAMES = ['.ternrc.json', '.ternrc', 'tern.config.json'];

export const DEFAULT_CONFIG: TernConfig = {
  ignoreChecks: [],
  ports: [3000, 5173, 8080, 8000, 4000, 4200, 5000],
  cleanPaths: [
    'node_modules/.cache',
    'dist',
    'build',
    '.next',
    '.nuxt',
    '.turbo',
    '.svelte-kit',
    'coverage',
    '.output',
    '.parcel-cache',
    '.docusaurus',
  ],
  minNodeVersion: '>=18.0.0',
  strict: false,
  deploy: {
    checkLocalhost: true,
    requiredConfigs: [],
  },
};

export async function loadConfig(cwd: string): Promise<TernConfig> {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = path.join(cwd, filename);
    try {
      const content = await fs.readFile(configPath, 'utf8');
      const parsed = JSON.parse(content);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        deploy: {
          ...DEFAULT_CONFIG.deploy,
          ...(parsed.deploy || {}),
        },
      };
    } catch {
      // File doesn't exist or is not valid JSON, try next
    }
  }

  return DEFAULT_CONFIG;
}
