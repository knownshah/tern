import fs from 'node:fs/promises';
import path from 'node:path';
import type { CheckDefinition, CheckResult, CheckContext, FixResult } from '../types/index.js';
import { isGitRepo, isFileTrackedByGit, addPatternToGitignore, untrackFile } from '../utils/git.js';

export const gitEnvTrackedCheck: CheckDefinition = {
  id: 'git-env-tracked',
  name: 'Git Secret & .env Protection',
  category: 'security',
  description: 'Verifies that .env files and secrets are ignored and not tracked by Git',
  run: async (context: CheckContext): Promise<CheckResult> => {
    const isRepo = await isGitRepo(context.cwd);
    if (!isRepo) {
      return {
        id: 'git-env-tracked',
        name: 'Git Secret & .env Protection',
        category: 'security',
        status: 'info',
        message: 'Not a Git repository; skipping Git .env tracking check',
        fixable: false,
      };
    }

    const sensitiveFiles = ['.env', '.env.local', '.env.production', '.env.staging'];
    const trackedFiles: string[] = [];

    for (const f of sensitiveFiles) {
      const tracked = await isFileTrackedByGit(context.cwd, f);
      if (tracked) {
        trackedFiles.push(f);
      }
    }

    if (trackedFiles.length > 0) {
      return {
        id: 'git-env-tracked',
        name: 'Git Secret & .env Protection',
        category: 'security',
        status: 'error',
        message: `CRITICAL: ${trackedFiles.join(', ')} is tracked by Git!`,
        details: [
          `Files containing secrets (${trackedFiles.join(', ')}) are currently committed/tracked in Git.`,
          'Anyone with repository access can view your secrets and API keys.',
          'They must be untracked immediately and added to .gitignore.',
        ],
        fixable: true,
        fix: async (): Promise<FixResult> => {
          try {
            await addPatternToGitignore(context.cwd, '.env*');
            await addPatternToGitignore(context.cwd, '!.env.example');
            for (const f of trackedFiles) {
              await untrackFile(context.cwd, f);
            }
            return {
              success: true,
              message: `Untracked ${trackedFiles.join(', ')} from Git cache and updated .gitignore`,
            };
          } catch (err: any) {
            return {
              success: false,
              message: `Failed to untrack sensitive files: ${err?.message}`,
            };
          }
        },
        hint: 'Run "tern fix" to remove sensitive files from Git index and add them to .gitignore.',
      };
    }

    // Check .gitignore
    const gitignorePath = path.join(context.cwd, '.gitignore');
    let gitignoreContent = '';
    let gitignoreExists = false;
    try {
      gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
      gitignoreExists = true;
    } catch {
      // File does not exist
    }

    const ignoresEnv =
      gitignoreContent.includes('.env') ||
      gitignoreContent.includes('.env*') ||
      gitignoreContent.includes('*.env');

    if (!gitignoreExists || !ignoresEnv) {
      return {
        id: 'git-env-tracked',
        name: 'Git Secret & .env Protection',
        category: 'security',
        status: 'warning',
        message: '.env is not ignored in .gitignore',
        details: [
          '.gitignore does not contain rules to ignore .env files.',
          'Future .env files may accidentally get committed.',
        ],
        fixable: true,
        fix: async (): Promise<FixResult> => {
          try {
            await addPatternToGitignore(context.cwd, '.env');
            await addPatternToGitignore(context.cwd, '.env.*');
            await addPatternToGitignore(context.cwd, '!.env.example');
            return {
              success: true,
              message: 'Added .env ignore patterns to .gitignore',
            };
          } catch (err: any) {
            return {
              success: false,
              message: `Failed to update .gitignore: ${err?.message}`,
            };
          }
        },
        hint: 'Run "tern fix" to add .env patterns to .gitignore.',
      };
    }

    return {
      id: 'git-env-tracked',
      name: 'Git Secret & .env Protection',
      category: 'security',
      status: 'success',
      message: '.env files properly ignored by Git',
      fixable: false,
    };
  },
};
