import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'os';
import { execCommandWithTimeout } from '../utils/exec.js';
import { parseEnvKeysFile } from '../utils/env.js';
import { getGitInfo } from '../utils/git.js';
import { findProcessOnPort } from '../utils/ports.js';
import { scanAgentEnvironment } from '../agent/scanner.js';
import type { EnvironmentSnapshot } from './types.js';

export interface SnapshotOptions {
  cwd?: string;
  portsToCheck?: number[];
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function detectFramework(pkg?: Record<string, any>): string | undefined {
  if (!pkg) return undefined;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (deps['next']) return 'nextjs';
  if (deps['nuxt']) return 'nuxt';
  if (deps['@remix-run/node'] || deps['@remix-run/react']) return 'remix';
  if (deps['@sveltejs/kit']) return 'sveltekit';
  if (deps['astro']) return 'astro';
  if (deps['vite']) return 'vite';
  if (deps['@nestjs/core']) return 'nestjs';
  if (deps['express']) return 'express';
  if (deps['fastify']) return 'fastify';
  if (deps['vue']) return 'vue';
  if (deps['react']) return 'react';

  return undefined;
}

export async function collectEnvironmentSnapshot(
  options: SnapshotOptions = {}
): Promise<EnvironmentSnapshot> {
  const cwd = options.cwd || process.cwd();
  const ports = options.portsToCheck || [3000, 3001, 5173, 8000, 8080];

  // 1. Read package.json if present
  let pkg: Record<string, any> | undefined;
  try {
    const raw = await fs.readFile(path.join(cwd, 'package.json'), 'utf8');
    pkg = JSON.parse(raw);
  } catch {
    pkg = undefined;
  }

  // 2. Package manager
  let pmName = 'npm';
  let pmVersion: string | undefined;

  if (pkg?.packageManager) {
    const [name, ver] = pkg.packageManager.split('@');
    pmName = name;
    pmVersion = ver;
  } else if (await fileExists(path.join(cwd, 'pnpm-lock.yaml'))) {
    pmName = 'pnpm';
  } else if (await fileExists(path.join(cwd, 'yarn.lock'))) {
    pmName = 'yarn';
  } else if (await fileExists(path.join(cwd, 'bun.lockb'))) {
    pmName = 'bun';
  } else if (await fileExists(path.join(cwd, 'package-lock.json'))) {
    pmName = 'npm';
  }

  if (!pmVersion) {
    try {
      const pmRes = await execCommandWithTimeout(pmName, ['--version'], {}, 2000);
      if (pmRes.code === 0 && pmRes.stdout) {
        pmVersion = pmRes.stdout.split('\n')[0].trim();
      }
    } catch {
      // ignore
    }
  }

  // 3. Git details
  const gitInfo = await getGitInfo(cwd);
  let gitVersion: string | undefined;
  try {
    const gitVerRes = await execCommandWithTimeout('git', ['--version'], {}, 2000);
    if (gitVerRes.code === 0 && gitVerRes.stdout) {
      gitVersion = gitVerRes.stdout.replace(/^git version\s+/i, '').trim();
    }
  } catch {
    // ignore
  }

  // 4. Environment variable keys (NEVER VALUES)
  const envExampleRes = await parseEnvKeysFile(path.join(cwd, '.env.example'));
  const envRes = await parseEnvKeysFile(path.join(cwd, '.env'));
  const allEnvKeys = Array.from(new Set([...envExampleRes.keys, ...envRes.keys])).sort();

  // 5. Ports status
  const portStatuses: EnvironmentSnapshot['ports'] = [];
  for (const port of ports) {
    const proc = await findProcessOnPort(port);
    if (proc) {
      portStatuses.push({
        port,
        status: 'occupied',
        process: proc.name,
      });
    } else {
      portStatuses.push({
        port,
        status: 'free',
      });
    }
  }

  // 6. AI Coding Agents
  const agentReport = await scanAgentEnvironment({ cwd });
  const aiAgents: EnvironmentSnapshot['aiAgents'] = agentReport.agents.map((a) => ({
    id: a.id,
    name: a.name,
    detected: a.detected,
    version: a.version,
  }));

  // 7. Configs existence
  const configs: EnvironmentSnapshot['configs'] = {
    hasPackageJson: Boolean(pkg),
    hasTsConfig: await fileExists(path.join(cwd, 'tsconfig.json')),
    hasDockerfile:
      (await fileExists(path.join(cwd, 'Dockerfile'))) ||
      (await fileExists(path.join(cwd, 'dockerfile'))),
    hasDockerCompose:
      (await fileExists(path.join(cwd, 'docker-compose.yml'))) ||
      (await fileExists(path.join(cwd, 'docker-compose.yaml'))) ||
      (await fileExists(path.join(cwd, 'compose.yaml'))),
    hasVercelJson: await fileExists(path.join(cwd, 'vercel.json')),
    hasNetlifyToml: await fileExists(path.join(cwd, 'netlify.toml')),
    hasMcpConfig: agentReport.mcp.configFilesFound.length > 0,
    hasAgentInstructions: agentReport.instructions.some((i) => i.exists),
  };

  return {
    schemaVersion: '1.0.0',
    timestamp: new Date().toISOString(),
    os: {
      platform: os.platform(),
      type: os.type(),
      release: os.release(),
      arch: os.arch(),
    },
    runtime: {
      node: process.version,
    },
    packageManager: {
      name: pmName,
      version: pmVersion,
    },
    git: {
      installed: Boolean(gitVersion),
      version: gitVersion,
      isRepo: gitInfo.isRepo,
      branch: gitInfo.branch,
    },
    project: {
      name: pkg?.name,
      version: pkg?.version,
      framework: detectFramework(pkg),
      dependencies: pkg?.dependencies || {},
      devDependencies: pkg?.devDependencies || {},
    },
    environment: {
      keysPresent: allEnvKeys,
      hasEnvExample: envExampleRes.exists,
      hasEnv: envRes.exists,
    },
    ports: portStatuses,
    aiAgents,
    configs,
  };
}
