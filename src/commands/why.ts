import chalk from 'chalk';
import ora from 'ora';
import { explainErrorLocally } from '../why/rules.js';
import type { WhyExplanation } from '../why/types.js';

export interface WhyCommandOptions {
  cwd?: string;
  ai?: boolean;
  json?: boolean;
  provider?: string;
}

export async function whyCommand(
  errorInput: string,
  options: WhyCommandOptions = {}
): Promise<number> {
  const cwd = options.cwd || process.cwd();
  const jsonOutput = Boolean(options.json);
  const useAI = Boolean(options.ai);

  if (!errorInput || errorInput.trim().length === 0) {
    if (jsonOutput) {
      console.log(
        JSON.stringify(
          {
            error: 'No error message provided. Usage: tern why "<error-message>"',
          },
          null,
          2
        )
      );
    } else {
      console.error(chalk.red('\nPlease provide an error message or code.'));
      console.error(chalk.dim('Example: tern why "EADDRINUSE: address already in use :::3000"\n'));
    }
    return 1;
  }

  // 1. Try local rules first
  let explanation: WhyExplanation | null = await explainErrorLocally(errorInput, { cwd });

  // 2. If no local rule matches or user explicitly wants AI
  if ((!explanation && useAI) || (explanation && useAI)) {
    const spinner = !jsonOutput
      ? ora({
          text: 'Analyzing error with AI provider...',
          color: 'cyan',
        }).start()
      : null;

    try {
      // Dynamic import to avoid circular dependency
      const { explainErrorWithAI } = await import('../ai/index.js');
      const aiResponse = await explainErrorWithAI(errorInput, {
        provider: options.provider,
      });

      explanation = {
        matched: true,
        title: explanation?.title || 'AI Error Analysis',
        meaning: aiResponse,
        suggestedFix: 'Review the steps outlined by the AI explanation above.',
        source: 'ai',
      };
    } catch (err: any) {
      if (!explanation) {
        spinner?.stop();
        if (jsonOutput) {
          console.log(
            JSON.stringify(
              {
                matched: false,
                error: err?.message || 'Failed to explain with AI',
              },
              null,
              2
            )
          );
        } else {
          console.error(chalk.red(`\nAI explanation error: ${err?.message}`));
        }
        return 1;
      }
    } finally {
      spinner?.stop();
    }
  }

  if (!explanation) {
    if (jsonOutput) {
      console.log(
        JSON.stringify(
          {
            matched: false,
            message: 'No local rule matched this error message.',
            hint: 'Try running with --ai flag to analyze with an AI provider.',
          },
          null,
          2
        )
      );
    } else {
      console.log(chalk.yellow(`\nNo local diagnostic rule matched this error.`));
      console.log(
        chalk.dim(
          'Tern handles errors like EADDRINUSE, MODULE_NOT_FOUND, ENOENT, EACCES, detached HEAD, etc.\n'
        )
      );
      console.log(
        chalk.cyan(`Run with `) +
          chalk.bold.cyan(`--ai`) +
          chalk.cyan(` to analyze using AI:\n  tern why "${errorInput}" --ai\n`)
      );
    }
    return 0;
  }

  if (jsonOutput) {
    console.log(JSON.stringify(explanation, null, 2));
    return 0;
  }

  // Visual layout
  console.log(chalk.bold.cyan(`\n${explanation.title}\n`));

  console.log(chalk.bold('Meaning'));
  console.log(chalk.white(explanation.meaning));
  console.log();

  if (explanation.detected && Object.keys(explanation.detected).length > 0) {
    console.log(chalk.bold('Detected'));
    for (const [k, v] of Object.entries(explanation.detected)) {
      console.log(`  ${chalk.dim(k)}: ${chalk.cyan(String(v))}`);
    }
    console.log();
  }

  console.log(chalk.bold('Suggested fix'));
  console.log(chalk.green(explanation.suggestedFix));

  if (explanation.runCommand) {
    console.log(chalk.dim('\nRun:'));
    console.log(`  ${chalk.cyan(explanation.runCommand)}`);
  }

  console.log();
  return 0;
}
