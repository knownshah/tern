import type { CheckDefinition, CheckResult, CheckContext } from '../types/index.js';
import { getGitInfo } from '../utils/git.js';

export const gitStatusCheck: CheckDefinition = {
  id: 'git-status',
  name: 'Git Repository Status',
  category: 'git',
  description:
    'Checks if directory is a Git repository, branch status, and working tree cleanliness',
  run: async (context: CheckContext): Promise<CheckResult> => {
    const gitInfo = await getGitInfo(context.cwd);

    if (!gitInfo.isRepo) {
      return {
        id: 'git-status',
        name: 'Git Repository Status',
        category: 'git',
        status: 'warning',
        message: 'Not a Git repository',
        details: [
          'No .git directory found or Git is not initialized.',
          'Version control is strongly recommended for development.',
        ],
        fixable: false,
        hint: 'Run "git init" to initialize a git repository.',
      };
    }

    const branch = gitInfo.branch ? `on ${gitInfo.branch}` : '';

    if (gitInfo.hasUncommitted) {
      const fileCount = gitInfo.uncommittedFiles.length;
      return {
        id: 'git-status',
        name: 'Git Repository Status',
        category: 'git',
        status: 'warning',
        message: `Git repository has ${fileCount} uncommitted change(s) (${branch})`,
        details: gitInfo.uncommittedFiles.slice(0, 10).map((f) => `Modified/Untracked: ${f}`),
        fixable: false,
        hint: 'Commit or stash your changes before deploying or running major upgrades.',
      };
    }

    if (gitInfo.unpushedCommitsCount > 0) {
      return {
        id: 'git-status',
        name: 'Git Repository Status',
        category: 'git',
        status: 'info',
        message: `Git repository has ${gitInfo.unpushedCommitsCount} unpushed commit(s) (${branch})`,
        fixable: false,
        hint: 'Remember to run "git push" to sync with upstream.',
      };
    }

    return {
      id: 'git-status',
      name: 'Git Repository Status',
      category: 'git',
      status: 'success',
      message: `Git repository clean (${branch})`,
      fixable: false,
    };
  },
};
