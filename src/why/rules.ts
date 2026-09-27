import { findProcessOnPort } from '../utils/ports.js';
import type { WhyExplanation } from './types.js';

export interface WhyRuleContext {
  cwd?: string;
}

export type WhyRuleFn = (
  errorMessage: string,
  context?: WhyRuleContext
) => Promise<WhyExplanation | null> | WhyExplanation | null;

export const whyRules: WhyRuleFn[] = [
  // 1. EADDRINUSE: Address already in use
  async (err: string) => {
    if (!/EADDRINUSE|address already in use/i.test(err)) return null;

    // Try to extract port from :::3000, :3000, port 3000, etc.
    const portMatch = err.match(/(?:::|:|\bport\s+)(\d{2,5})\b/i);
    const port = portMatch ? parseInt(portMatch[1], 10) : undefined;

    const detected: Record<string, string | number> = {};

    if (port) {
      detected.Port = port;
      try {
        const proc = await findProcessOnPort(port);
        if (proc) {
          detected.PID = proc.pid;
          detected.Process = proc.name;
        }
      } catch {
        // ignore port lookup errors
      }
    }

    const portStr = port ? `port ${port}` : 'the specified port';
    const fixCmd = port ? `tern port ${port} --kill` : 'tern port <number> --kill';

    return {
      matched: true,
      ruleId: 'EADDRINUSE',
      title: 'EADDRINUSE',
      meaning: `Another process is already using ${portStr}.`,
      detected: Object.keys(detected).length > 0 ? detected : undefined,
      suggestedFix: `${fixCmd}\nAlternatively, free the port or change your application's port configuration.`,
      runCommand: fixCmd,
      source: 'local-rule',
    };
  },

  // 2. MODULE_NOT_FOUND / Cannot find module
  (err: string) => {
    if (!/MODULE_NOT_FOUND|Cannot find module/i.test(err)) return null;

    const modMatch = err.match(/Cannot find module ['"]([^'"]+)['"]/i);
    const moduleName = modMatch ? modMatch[1] : undefined;

    const isLocalRelative = moduleName?.startsWith('.') || moduleName?.startsWith('/');
    const meaning = isLocalRelative
      ? `The file path '${moduleName}' does not exist or has an incorrect extension/relative path.`
      : moduleName
        ? `Node.js cannot find the package '${moduleName}' in your node_modules directory.`
        : 'A required module or file cannot be found by the runtime.';

    const suggestedFix = isLocalRelative
      ? `Check that the file '${moduleName}' exists, verify relative import path and file extension (.js/.ts).`
      : moduleName
        ? `Install the missing package:\npnpm install ${moduleName} (or npm install ${moduleName})`
        : 'Run "pnpm install" or "npm install" to ensure all project dependencies are installed.';

    return {
      matched: true,
      ruleId: 'MODULE_NOT_FOUND',
      title: 'MODULE_NOT_FOUND',
      meaning,
      detected: moduleName ? { Module: moduleName } : undefined,
      suggestedFix,
      source: 'local-rule',
    };
  },

  // 3. ENOENT: No such file or directory
  (err: string) => {
    if (!/ENOENT|no such file or directory/i.test(err)) return null;

    const pathMatch = err.match(
      /no such file or directory,?\s*(?:open|stat|access)?\s*['"]?([^'"\n]+)['"]?/i
    );
    const targetPath = pathMatch ? pathMatch[1].trim() : undefined;

    return {
      matched: true,
      ruleId: 'ENOENT',
      title: 'ENOENT',
      meaning: targetPath
        ? `The file or directory '${targetPath}' does not exist or cannot be accessed.`
        : 'A specified file or directory path does not exist.',
      detected: targetPath ? { Path: targetPath } : undefined,
      suggestedFix:
        'Verify the path spelling, ensure parent directories exist, or run your build step (e.g. "pnpm build") if expecting generated files.',
      source: 'local-rule',
    };
  },

  // 4. EACCES / permission denied
  (err: string) => {
    if (!/EACCES|permission denied/i.test(err)) return null;

    const portMatch = err.match(/(?:::|:|\bport\s+)(\d{1,5})\b/i);
    const port = portMatch ? parseInt(portMatch[1], 10) : undefined;
    const isPrivileged = port && port < 1024;

    return {
      matched: true,
      ruleId: 'EACCES',
      title: 'EACCES / Permission Denied',
      meaning: isPrivileged
        ? `Binding to privileged port ${port} (< 1024) requires root/administrator privileges.`
        : 'The operating system denied permission to read, write, or execute the specified resource.',
      detected: port ? { Port: port } : undefined,
      suggestedFix: isPrivileged
        ? `Change the port to >= 1024 (e.g. 3000, 8080) for local development.`
        : 'Check file system permissions using "ls -la" and adjust ownership with chmod or chown.',
      source: 'local-rule',
    };
  },

  // 5. command not found / not recognized
  (err: string) => {
    if (!/command not found|is not recognized as an internal or external command/i.test(err))
      return null;

    const cmdMatch =
      err.match(/([a-zA-Z0-9_-]+):\s*command not found/i) ||
      err.match(/'([^']+)' is not recognized as an internal/i);
    const cmd = cmdMatch ? cmdMatch[1] : undefined;

    return {
      matched: true,
      ruleId: 'COMMAND_NOT_FOUND',
      title: 'Command Not Found',
      meaning: cmd
        ? `The executable command '${cmd}' is not installed or not in your system PATH.`
        : 'The specified command does not exist in your environment PATH.',
      detected: cmd ? { Command: cmd } : undefined,
      suggestedFix: cmd
        ? `Install '${cmd}' using your package manager or verify your PATH environment variable.`
        : 'Ensure the necessary tool is installed and its binary directory is added to PATH.',
      source: 'local-rule',
    };
  },

  // 6. npm / pnpm peer dependency conflict (ERESOLVE)
  (err: string) => {
    if (
      !/ERESOLVE|unable to resolve dependency tree|conflicting peer dependency|peer dep/i.test(err)
    )
      return null;

    return {
      matched: true,
      ruleId: 'PEER_DEP_CONFLICT',
      title: 'Peer Dependency Conflict (ERESOLVE)',
      meaning:
        'Multiple installed packages require conflicting, incompatible versions of the same dependency.',
      suggestedFix:
        '1. Align package versions in package.json.\n2. In npm, run with "--legacy-peer-deps" temporarily.\n3. Run "tern deps" to audit dependency versions.',
      runCommand: 'tern deps',
      source: 'local-rule',
    };
  },

  // 7. Git detached HEAD
  (err: string) => {
    if (!/detached HEAD|HEAD detached at/i.test(err)) return null;

    return {
      matched: true,
      ruleId: 'GIT_DETACHED_HEAD',
      title: 'Git Detached HEAD',
      meaning:
        'Git HEAD is currently pointing directly to a specific commit instead of a named branch. Any new commits will become orphaned if you switch away.',
      suggestedFix:
        'Create a new branch from this commit:\ngit checkout -b <new-branch-name>\nOr switch back to your main branch:\ngit checkout main',
      source: 'local-rule',
    };
  },

  // 8. Missing environment variable
  (err: string) => {
    if (
      !/is not defined|process\.env\.([A-Za-z0-9_]+) is undefined|missing environment variable|Env variable/i.test(
        err
      )
    )
      return null;

    const keyMatch =
      err.match(/process\.env\.([A-Za-z0-9_]+)/i) ||
      err.match(/([A-Z0-9_]{3,})\s*(?:is not defined|is missing|is required)/i);
    const envKey = keyMatch ? keyMatch[1] : undefined;

    return {
      matched: true,
      ruleId: 'MISSING_ENV_VAR',
      title: 'Missing Environment Variable',
      meaning: envKey
        ? `The application expects '${envKey}' to be defined in your environment or .env file.`
        : 'A required environment variable was not found during execution.',
      detected: envKey ? { Variable: envKey } : undefined,
      suggestedFix:
        'Add the variable to your local .env file and run "tern env" to verify consistency.',
      runCommand: 'tern env',
      source: 'local-rule',
    };
  },

  // 9. Connection Refused (ECONNREFUSED)
  (err: string) => {
    if (!/ECONNREFUSED|connection refused/i.test(err)) return null;

    const hostMatch = err.match(/(?:connect\s+)?([a-zA-Z0-9.-]+):(\d{2,5})/i);
    const host = hostMatch ? hostMatch[1] : undefined;
    const port = hostMatch ? hostMatch[2] : undefined;

    let serviceHint = 'database or backend service';
    if (port === '5432') serviceHint = 'PostgreSQL';
    else if (port === '27017') serviceHint = 'MongoDB';
    else if (port === '6379') serviceHint = 'Redis';
    else if (port === '3306') serviceHint = 'MySQL';

    return {
      matched: true,
      ruleId: 'ECONNREFUSED',
      title: 'Connection Refused (ECONNREFUSED)',
      meaning: `The connection to ${host || 'target'}:${port || 'port'} was rejected. The ${serviceHint} is not running or not listening at this address.`,
      detected: host && port ? { Host: host, Port: port, LikelyService: serviceHint } : undefined,
      suggestedFix: `1. Ensure the ${serviceHint} daemon/container is running.\n2. Check host and port settings in your .env.\n3. If using Docker, run "docker compose up -d".`,
      source: 'local-rule',
    };
  },

  // 10. TypeScript common errors
  (err: string) => {
    const tsMatch = err.match(/\bTS(2304|2322|2345|7006|2307)\b/i);
    if (!tsMatch) return null;

    const code = `TS${tsMatch[1]}`;
    let meaning = 'TypeScript type checking error.';
    let fix = 'Review the types in your code.';

    switch (code) {
      case 'TS2304':
        meaning =
          'Cannot find name: An identifier was used without being declared, or type definitions are missing.';
        fix = "Declare the variable or install missing types (e.g. 'pnpm add -D @types/node').";
        break;
      case 'TS2322':
        meaning =
          'Type is not assignable: A value does not match the expected property or variable type.';
        fix = 'Ensure the assigned object/value satisfies the required TypeScript interface.';
        break;
      case 'TS2345':
        meaning =
          'Argument not assignable: A function call passed arguments that do not match parameter types.';
        fix = 'Update the arguments passed to match the function declaration signature.';
        break;
      case 'TS7006':
        meaning =
          "Implicit 'any': A parameter was not typed and TypeScript 'noImplicitAny' is enabled.";
        fix = "Add an explicit type annotation to the parameter: '(param: string) => ...'.";
        break;
      case 'TS2307':
        meaning =
          'Cannot find module or type declarations: Imported module is not installed or lacks types.';
        fix = 'Install the package and its corresponding @types package if available.';
        break;
    }

    return {
      matched: true,
      ruleId: code,
      title: `TypeScript Error ${code}`,
      meaning,
      detected: { ErrorCode: code },
      suggestedFix: fix,
      source: 'local-rule',
    };
  },
];

export async function explainErrorLocally(
  errorMessage: string,
  context?: WhyRuleContext
): Promise<WhyExplanation | null> {
  for (const rule of whyRules) {
    const result = await rule(errorMessage, context);
    if (result) {
      return result;
    }
  }
  return null;
}
