import chalk from 'chalk';
import ora from 'ora';
import { createContext, runAllChecks } from '../checks/index.js';
import { buildSanitizedDiagnosticPayload } from '../ai/sanitize.js';
import { getProvider } from '../ai/provider.js';
import type { CheckResult } from '../types/index.js';

export interface ExplainCommandOptions {
  cwd?: string;
  provider?: string;
  json?: boolean;
}

export async function explainCommand(options: ExplainCommandOptions = {}): Promise<number> {
  const cwd = options.cwd || process.cwd();
  const jsonOutput = Boolean(options.json);

  const spinner = !jsonOutput
    ? ora({
        text: 'Running environment diagnostics...',
        color: 'cyan',
      }).start()
    : null;

  let results: CheckResult[];
  let context: any;

  try {
    context = await createContext(cwd, false);
    results = await runAllChecks(context);
  } finally {
    spinner?.stop();
  }

  // Filter issues
  const issues = results.filter((r) => r.status === 'error' || r.status === 'warning');

  if (issues.length === 0) {
    if (jsonOutput) {
      console.log(
        JSON.stringify(
          {
            status: 'healthy',
            message: 'No issues found in your environment. Everything is healthy!',
            issues: [],
          },
          null,
          2
        )
      );
    } else {
      console.log(
        chalk.green.bold('\n✓ No issues detected in your environment! Everything is healthy.\n')
      );
    }
    return 0;
  }

  // Build sanitized payload
  const sanitizedPayload = buildSanitizedDiagnosticPayload(results, context);

  let provider;
  try {
    provider = getProvider(options.provider);
  } catch (err: any) {
    if (jsonOutput) {
      console.log(JSON.stringify({ error: err?.message }, null, 2));
    } else {
      console.error(chalk.red(`\n${err?.message}\n`));
    }
    return 1;
  }

  const aiSpinner = !jsonOutput
    ? ora({
        text: `Analyzing ${issues.length} issue(s) using ${provider.name}...`,
        color: 'cyan',
      }).start()
    : null;

  let explanation: string;
  try {
    explanation = await provider.explainIssues(sanitizedPayload);
    aiSpinner?.stop();
  } catch (err: any) {
    aiSpinner?.stop();
    if (jsonOutput) {
      console.log(
        JSON.stringify(
          {
            error: err?.message,
            provider: provider.name,
            sanitizedPayload,
          },
          null,
          2
        )
      );
    } else {
      console.error(chalk.red(`\nAI Explanation Failed: ${err?.message}`));
      if (!provider.isConfigured()) {
        console.log(chalk.dim(`\n${provider.getMissingConfigInstructions()}\n`));
      }
    }
    return 1;
  }

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          provider: provider.name,
          issuesCount: issues.length,
          explanation,
          sanitizedPayload,
        },
        null,
        2
      )
    );
    return 0;
  }

  console.log(chalk.bold.cyan(`\nTern AI Diagnostic Explanation (${provider.name})\n`));
  console.log(explanation);
  console.log();
  return 0;
}
