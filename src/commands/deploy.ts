import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import fg from 'fast-glob';
import { isFileTrackedByGit } from '../utils/git.js';
import { icons } from '../utils/logger.js';

export interface DeployOptions {
  cwd?: string;
  checkLocalhost?: boolean;
}

interface LocalhostFinding {
  file: string;
  line: number;
  match: string;
}

export async function deployCommand(options: DeployOptions = {}): Promise<number> {
  const cwd = options.cwd || process.cwd();
  console.log(chalk.bold(`\nTern Deployment Readiness Inspector`));

  const spinner = ora('Checking deployment configuration and safety...').start();
  let hasFailures = false;
  let hasWarnings = false;

  const checksOutput: Array<{
    status: 'pass' | 'warn' | 'fail';
    message: string;
    details?: string[];
  }> = [];

  // 1. Check package.json & build script
  let pkg: any = {};
  try {
    const raw = await fs.readFile(path.join(cwd, 'package.json'), 'utf8');
    pkg = JSON.parse(raw);
  } catch {
    // missing
  }

  if (pkg.scripts?.build) {
    checksOutput.push({
      status: 'pass',
      message: `Build script found in package.json ("${pkg.scripts.build}")`,
    });
  } else {
    hasWarnings = true;
    checksOutput.push({
      status: 'warn',
      message: 'No "build" script declared in package.json',
      details: [
        'Most cloud providers (Vercel, Netlify, Render) trigger "npm run build" during deployment.',
      ],
    });
  }

  // 2. Check production environment files
  const isEnvProdTracked = await isFileTrackedByGit(cwd, '.env.production');
  if (isEnvProdTracked) {
    hasFailures = true;
    checksOutput.push({
      status: 'fail',
      message: 'CRITICAL: .env.production is committed/tracked in Git!',
      details: [
        'Production credentials must be set in your cloud provider environment dashboard, never in Git.',
      ],
    });
  } else {
    checksOutput.push({
      status: 'pass',
      message: '.env.production is safely ignored or uncommitted',
    });
  }

  // 3. Check deployment configurations
  const deployConfigs = [
    'Dockerfile',
    'vercel.json',
    'netlify.toml',
    'fly.toml',
    'docker-compose.yml',
    'render.yaml',
  ];
  const detectedConfigs: string[] = [];
  for (const cfg of deployConfigs) {
    try {
      await fs.access(path.join(cwd, cfg));
      detectedConfigs.push(cfg);
    } catch {
      // Not found
    }
  }

  if (detectedConfigs.length > 0) {
    checksOutput.push({
      status: 'pass',
      message: `Deployment platform config detected: ${detectedConfigs.join(', ')}`,
    });
  } else {
    checksOutput.push({
      status: 'warn',
      message:
        'No specific platform configuration file found (e.g. vercel.json, Dockerfile, netlify.toml)',
      details: ['Ensure your hosting provider knows how to start and build your application.'],
    });
  }

  // 4. Scan source files for hardcoded localhost / 127.0.0.1 URLs
  const localhostFindings: LocalhostFinding[] = [];
  const srcFiles = await fg(
    ['src/**/*.{js,jsx,ts,tsx}', 'app/**/*.{js,jsx,ts,tsx}', 'pages/**/*.{js,jsx,ts,tsx}'],
    {
      cwd,
      ignore: [
        '**/*.test.*',
        '**/*.spec.*',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/node_modules/**',
      ],
    }
  );

  const localhostRegex = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:[a-zA-Z0-9_\-./]*)/g;

  for (const relFile of srcFiles) {
    try {
      const fullPath = path.join(cwd, relFile);
      const content = await fs.readFile(fullPath, 'utf8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const matches = line.match(localhostRegex);
        if (matches) {
          for (const m of matches) {
            localhostFindings.push({
              file: relFile,
              line: i + 1,
              match: m,
            });
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  if (localhostFindings.length > 0) {
    hasWarnings = true;
    checksOutput.push({
      status: 'warn',
      message: `Found ${localhostFindings.length} hardcoded localhost URL(s) in source code`,
      details: localhostFindings
        .slice(0, 5)
        .map((f) => `${f.file}:${f.line} -> ${f.match}`)
        .concat(
          localhostFindings.length > 5 ? [`...and ${localhostFindings.length - 5} more`] : []
        ),
    });
  } else {
    checksOutput.push({
      status: 'pass',
      message: 'No hardcoded localhost/127.0.0.1 URLs detected in production source files',
    });
  }

  spinner.stop();

  console.log();
  for (const item of checksOutput) {
    if (item.status === 'pass') {
      console.log(`${icons.success} ${item.message}`);
    } else if (item.status === 'warn') {
      console.log(`${icons.warning} ${chalk.yellow(item.message)}`);
      if (item.details) {
        item.details.forEach((d) => console.log(`    ${chalk.dim('•')} ${chalk.gray(d)}`));
      }
    } else {
      console.log(`${icons.error} ${chalk.red(item.message)}`);
      if (item.details) {
        item.details.forEach((d) => console.log(`    ${chalk.dim('•')} ${chalk.red(d)}`));
      }
    }
  }

  console.log();
  if (hasFailures) {
    console.log(
      chalk.red.bold(
        '✗ Deployment readiness check FAILED. Address critical issues above before deploying.\n'
      )
    );
    return 1;
  }

  if (hasWarnings) {
    console.log(
      chalk.yellow.bold(
        '⚠ Deployment readiness passed with warnings. Review recommendations above.\n'
      )
    );
    return 0;
  }

  console.log(
    chalk.green.bold('✓ Deployment readiness check PASSED! Project is ready for production.\n')
  );
  return 0;
}
