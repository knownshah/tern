import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { getGitInfo, scanContentForSecrets, type SecretFinding } from '../utils/git.js';
import { execCommand } from '../utils/exec.js';
import { icons } from '../utils/logger.js';

export interface GitOptions {
  cwd?: string;
  scanSecrets?: boolean;
}

export async function gitCommand(options: GitOptions = {}): Promise<number> {
  const cwd = options.cwd || process.cwd();
  console.log(chalk.bold(`\nTern Git Diagnostics`));

  const gitInfo = await getGitInfo(cwd);

  if (!gitInfo.isRepo) {
    console.log(chalk.red(`${icons.error} Current directory is not a Git repository.`));
    console.log(chalk.dim('Run "git init" to initialize Git tracking.\n'));
    return 1;
  }

  console.log(`  ${chalk.bold('Branch:')}        ${chalk.cyan(gitInfo.branch || 'unknown')}`);

  if (gitInfo.hasUncommitted) {
    console.log(
      `  ${chalk.bold('Working Tree:')}  ${chalk.yellow(`${gitInfo.uncommittedFiles.length} uncommitted file(s)`)}`
    );
  } else {
    console.log(`  ${chalk.bold('Working Tree:')}  ${chalk.green('Clean')}`);
  }

  if (gitInfo.unpushedCommitsCount > 0) {
    console.log(
      `  ${chalk.bold('Commits:')}       ${chalk.yellow(`${gitInfo.unpushedCommitsCount} unpushed commit(s)`)}`
    );
  } else {
    console.log(`  ${chalk.bold('Commits:')}       ${chalk.green('In sync with upstream')}`);
  }

  console.log();

  // Scan uncommitted files and recent git log for secrets
  const scanSpinner = ora(
    'Scanning working tree and staged files for potential secrets...'
  ).start();
  const secretFindings: SecretFinding[] = [];

  // 1. Scan uncommitted files
  for (const relFile of gitInfo.uncommittedFiles) {
    // Skip binary files or lockfiles
    if (
      relFile.endsWith('.png') ||
      relFile.endsWith('.jpg') ||
      relFile.endsWith('.ico') ||
      relFile.endsWith('.lock') ||
      relFile.endsWith('.lockb') ||
      relFile.endsWith('.yaml') ||
      relFile.includes('node_modules/')
    ) {
      continue;
    }

    try {
      const fullPath = path.join(cwd, relFile);
      const content = await fs.readFile(fullPath, 'utf8');
      const findings = scanContentForSecrets(content, relFile);
      secretFindings.push(...findings);
    } catch {
      // File could be deleted or unreadable
    }
  }

  // 2. Scan git diff of last commit if available
  const diffRes = await execCommand('git', ['diff', 'HEAD~1..HEAD', '--no-color'], { cwd });
  if (diffRes.code === 0 && diffRes.stdout) {
    const diffFindings = scanContentForSecrets(diffRes.stdout, 'recent commit diff');
    secretFindings.push(...diffFindings);
  }

  scanSpinner.stop();

  if (secretFindings.length === 0) {
    console.log(
      chalk.green(`${icons.success} No exposed secrets or API keys detected in repository.\n`)
    );
    return gitInfo.hasUncommitted ? 0 : 0;
  }

  console.log(
    chalk.red.bold(
      `\n${icons.error} SECURITY WARNING: Found ${secretFindings.length} possible secret(s) in repository!`
    )
  );
  console.log(chalk.dim('Values are redacted for security. Review and remove them immediately:'));

  for (const finding of secretFindings) {
    console.log(
      `  ${chalk.red('•')} ${chalk.bold(finding.file)}${finding.line ? `:${finding.line}` : ''} - ${chalk.yellow(finding.patternName)} (${chalk.dim(finding.description)})`
    );
  }

  console.log(
    chalk.cyan('\nTips to remediate:') +
      chalk.dim(
        '\n  1. Move secrets into .env and verify .env is in .gitignore.\n  2. If already committed, revoke the API key and rotate it immediately.'
      )
  );
  console.log();

  return 1;
}
