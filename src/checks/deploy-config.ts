import fs from 'node:fs/promises';
import path from 'node:path';
import type { CheckDefinition, CheckResult, CheckContext } from '../types/index.js';
import { isFileTrackedByGit } from '../utils/git.js';

interface DeployFileInfo {
  name: string;
  type: string;
  exists: boolean;
}

export const deployConfigCheck: CheckDefinition = {
  id: 'deploy-config',
  name: 'Deployment Readiness & Configuration',
  category: 'deploy',
  description:
    'Checks for deployment configurations (Dockerfile, Vercel, Netlify) and production safety',
  run: async (context: CheckContext): Promise<CheckResult> => {
    const deployFiles: DeployFileInfo[] = [
      { name: 'Dockerfile', type: 'Docker', exists: false },
      { name: 'docker-compose.yml', type: 'Docker Compose', exists: false },
      { name: 'docker-compose.yaml', type: 'Docker Compose', exists: false },
      { name: 'vercel.json', type: 'Vercel', exists: false },
      { name: 'netlify.toml', type: 'Netlify', exists: false },
      { name: 'fly.toml', type: 'Fly.io', exists: false },
      { name: 'render.yaml', type: 'Render', exists: false },
      { name: 'railway.json', type: 'Railway', exists: false },
      { name: '.github/workflows/deploy.yml', type: 'GitHub Actions Deploy', exists: false },
    ];

    for (const df of deployFiles) {
      try {
        await fs.access(path.join(context.cwd, df.name));
        df.exists = true;
      } catch {
        df.exists = false;
      }
    }

    const foundConfigs = deployFiles.filter((df) => df.exists);
    const issues: string[] = [];

    // Check vercel.json syntax if exists
    if (foundConfigs.some((c) => c.name === 'vercel.json')) {
      try {
        const vercelRaw = await fs.readFile(path.join(context.cwd, 'vercel.json'), 'utf8');
        JSON.parse(vercelRaw);
      } catch (err: any) {
        issues.push(`Invalid JSON syntax in vercel.json: ${err?.message}`);
      }
    }

    // Check railway.json syntax if exists
    if (foundConfigs.some((c) => c.name === 'railway.json')) {
      try {
        const railwayRaw = await fs.readFile(path.join(context.cwd, 'railway.json'), 'utf8');
        JSON.parse(railwayRaw);
      } catch (err: any) {
        issues.push(`Invalid JSON syntax in railway.json: ${err?.message}`);
      }
    }

    // Check if .env.production is tracked by Git
    const envProdTracked = await isFileTrackedByGit(context.cwd, '.env.production');
    if (envProdTracked) {
      issues.push('.env.production is tracked by Git (high risk of exposing prod secrets)');
    }

    // Check build script in package.json
    const hasBuildScript = Boolean(context.pkg?.scripts?.build);
    if (!hasBuildScript && foundConfigs.length > 0) {
      issues.push('Missing "build" script in package.json for production deployment');
    }

    if (issues.length > 0) {
      return {
        id: 'deploy-config',
        name: 'Deployment Readiness & Configuration',
        category: 'deploy',
        status: envProdTracked ? 'error' : 'warning',
        message: `Deployment configuration issues detected: ${issues[0]}`,
        details: issues,
        fixable: false,
        hint: 'Review your deployment configuration and ensure production secrets are protected.',
      };
    }

    if (foundConfigs.length === 0) {
      return {
        id: 'deploy-config',
        name: 'Deployment Readiness & Configuration',
        category: 'deploy',
        status: 'info',
        message: 'No specific deployment configuration detected (standard Node.js project)',
        details: [
          'Detected no Vercel, Netlify, Docker, or Cloud config.',
          'If this project will be deployed, consider adding a Dockerfile or provider config.',
        ],
        fixable: false,
      };
    }

    const configNames = foundConfigs.map((c) => `${c.name} (${c.type})`).join(', ');
    return {
      id: 'deploy-config',
      name: 'Deployment Readiness & Configuration',
      category: 'deploy',
      status: 'success',
      message: `Deployment configuration valid: ${configNames}`,
      fixable: false,
    };
  },
};
