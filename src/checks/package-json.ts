import fs from 'node:fs/promises';
import path from 'node:path';
import type { CheckDefinition, CheckResult, CheckContext, FixResult } from '../types/index.js';
import { execCommand } from '../utils/exec.js';

export const packageJsonCheck: CheckDefinition = {
  id: 'package-json',
  name: 'Package.json & Dependencies Installation',
  category: 'package',
  description:
    'Checks package.json validity, required metadata, scripts, and node_modules installation',
  run: async (context: CheckContext): Promise<CheckResult> => {
    const pkgPath = path.join(context.cwd, 'package.json');
    let pkgContent: string;
    let parsed: any;

    try {
      pkgContent = await fs.readFile(pkgPath, 'utf8');
    } catch {
      return {
        id: 'package-json',
        name: 'Package.json & Dependencies Installation',
        category: 'package',
        status: 'error',
        message: 'Missing package.json file in project root',
        fixable: false,
        hint: 'Run "npm init" or "pnpm init" to create a package.json file.',
      };
    }

    try {
      parsed = JSON.parse(pkgContent);
    } catch (err: any) {
      return {
        id: 'package-json',
        name: 'Package.json & Dependencies Installation',
        category: 'package',
        status: 'error',
        message: `Invalid package.json syntax: ${err?.message}`,
        fixable: false,
        hint: 'Fix the JSON syntax errors in your package.json file.',
      };
    }

    const issues: string[] = [];
    if (!parsed.name) issues.push('Missing "name" field');
    if (!parsed.version) issues.push('Missing "version" field');

    const scripts = parsed.scripts || {};
    const hasDev = Boolean(scripts.dev || scripts.start);
    const hasBuild = Boolean(scripts.build);
    const hasTest = Boolean(scripts.test);

    if (!hasDev && !hasBuild) {
      issues.push('Missing "dev", "start", or "build" scripts');
    }

    // Check node_modules
    const nodeModulesPath = path.join(context.cwd, 'node_modules');
    let nodeModulesExists = false;
    try {
      await fs.access(nodeModulesPath);
      nodeModulesExists = true;
    } catch {
      // Missing
    }

    if (!nodeModulesExists) {
      // Determine package manager
      let pmCmd = 'npm';
      try {
        await fs.access(path.join(context.cwd, 'pnpm-lock.yaml'));
        pmCmd = 'pnpm';
      } catch {
        try {
          await fs.access(path.join(context.cwd, 'yarn.lock'));
          pmCmd = 'yarn';
        } catch {
          try {
            await fs.access(path.join(context.cwd, 'bun.lockb'));
            pmCmd = 'bun';
          } catch {
            pmCmd = 'npm';
          }
        }
      }

      return {
        id: 'package-json',
        name: 'Package.json & Dependencies Installation',
        category: 'package',
        status: 'error',
        message: 'node_modules directory is missing (dependencies not installed)',
        details: [
          'Dependencies defined in package.json are not installed locally.',
          `Recommended command: ${pmCmd} install`,
        ],
        fixable: true,
        fix: async (): Promise<FixResult> => {
          const res = await execCommand(pmCmd, ['install'], { cwd: context.cwd });
          if (res.code === 0) {
            return {
              success: true,
              message: `Successfully installed dependencies using ${pmCmd} install`,
            };
          }
          return {
            success: false,
            message: `Failed to install dependencies: ${res.stderr || res.stdout}`,
          };
        },
        hint: `Run "${pmCmd} install" to install project dependencies.`,
      };
    }

    if (issues.length > 0) {
      return {
        id: 'package-json',
        name: 'Package.json & Dependencies Installation',
        category: 'package',
        status: 'warning',
        message: `package.json has warnings: ${issues.join(', ')}`,
        details: issues,
        fixable: false,
      };
    }

    const scriptSummary = [
      hasDev ? 'dev' : null,
      hasBuild ? 'build' : null,
      hasTest ? 'test' : null,
    ]
      .filter(Boolean)
      .join(', ');

    return {
      id: 'package-json',
      name: 'Package.json & Dependencies Installation',
      category: 'package',
      status: 'success',
      message: `package.json valid (${parsed.name}@${parsed.version}, scripts: ${scriptSummary || 'standard'}, node_modules installed)`,
      fixable: false,
    };
  },
};
