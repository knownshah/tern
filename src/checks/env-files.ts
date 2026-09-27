import type { CheckDefinition, CheckResult, CheckContext, FixResult } from '../types/index.js';
import { compareEnvFiles, addMissingKeysToEnv } from '../utils/env.js';

export const envFilesCheck: CheckDefinition = {
  id: 'env-files',
  name: 'Environment Variables Consistency',
  category: 'env',
  description: 'Compares .env with .env.example without leaking variable values',
  run: async (context: CheckContext): Promise<CheckResult> => {
    const analysis = await compareEnvFiles(context.cwd);

    if (!analysis.hasEnvExample) {
      if (!analysis.hasEnv) {
        return {
          id: 'env-files',
          name: 'Environment Variables Consistency',
          category: 'env',
          status: 'info',
          message: 'No .env or .env.example files found in project root',
          fixable: false,
        };
      }

      return {
        id: 'env-files',
        name: 'Environment Variables Consistency',
        category: 'env',
        status: 'warning',
        message: '.env exists but .env.example is missing',
        details: [
          'A .env.example template helps teammates and CI pipelines know which environment variables are required.',
        ],
        fixable: false,
        hint: 'Create a .env.example file listing required keys with blank or dummy values.',
      };
    }

    if (!analysis.hasEnv) {
      return {
        id: 'env-files',
        name: 'Environment Variables Consistency',
        category: 'env',
        status: 'error',
        message: 'Missing .env file (.env.example found with keys)',
        details: analysis.exampleKeys.map((k) => `Missing key: ${k}`),
        fixable: true,
        fix: async (): Promise<FixResult> => {
          try {
            await addMissingKeysToEnv(context.cwd, analysis.exampleKeys);
            return {
              success: true,
              message: `Created .env template with ${analysis.exampleKeys.length} placeholder keys`,
            };
          } catch (err: any) {
            return {
              success: false,
              message: `Failed to create .env: ${err?.message}`,
            };
          }
        },
        hint: 'Run "tern fix" to initialize .env from .env.example with blank values.',
      };
    }

    if (analysis.missingKeys.length > 0) {
      const keysList = analysis.missingKeys.join(', ');
      return {
        id: 'env-files',
        name: 'Environment Variables Consistency',
        category: 'env',
        status: 'error',
        message: `Missing ${analysis.missingKeys.length} environment variable(s) from .env: ${keysList}`,
        details: analysis.missingKeys.map((k) => `Missing key: ${k}`),
        fixable: true,
        fix: async (): Promise<FixResult> => {
          try {
            await addMissingKeysToEnv(context.cwd, analysis.missingKeys);
            return {
              success: true,
              message: `Added ${analysis.missingKeys.length} missing keys to .env`,
            };
          } catch (err: any) {
            return {
              success: false,
              message: `Failed to update .env: ${err?.message}`,
            };
          }
        },
        hint: 'Run "tern fix" to append the missing keys to your .env file.',
      };
    }

    if (analysis.emptyKeys.length > 0) {
      return {
        id: 'env-files',
        name: 'Environment Variables Consistency',
        category: 'env',
        status: 'warning',
        message: `${analysis.emptyKeys.length} environment variable(s) in .env have empty values: ${analysis.emptyKeys.join(', ')}`,
        details: analysis.emptyKeys.map((k) => `Empty key: ${k}`),
        fixable: false,
        hint: 'Check that empty variables are intentionally optional.',
      };
    }

    return {
      id: 'env-files',
      name: 'Environment Variables Consistency',
      category: 'env',
      status: 'success',
      message: `Environment variables synced (${analysis.envKeys.length} keys verified)`,
      fixable: false,
    };
  },
};
