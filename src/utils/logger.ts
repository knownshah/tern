import chalk from 'chalk';
import boxen from 'boxen';
import type { CheckResult, HealthScore } from '../types/index.js';

export const icons = {
  success: chalk.green('✓'),
  warning: chalk.yellow('⚠'),
  error: chalk.red('✗'),
  info: chalk.cyan('ℹ'),
  skipped: chalk.gray('○'),
  arrow: chalk.blue('→'),
  bullet: chalk.gray('•'),
};

export function getStatusBadge(status: CheckResult['status']): string {
  switch (status) {
    case 'success':
      return chalk.green.bold(' PASS ');
    case 'warning':
      return chalk.yellow.bold(' WARN ');
    case 'error':
      return chalk.red.bold(' FAIL ');
    case 'info':
      return chalk.cyan.bold(' INFO ');
    case 'skipped':
      return chalk.gray.bold(' SKIP ');
  }
}

export function formatCheckResult(result: CheckResult, verbose = false): string {
  const icon = icons[result.status];
  const msg =
    result.status === 'error'
      ? chalk.red(result.message)
      : result.status === 'warning'
        ? chalk.yellow(result.message)
        : chalk.white(result.message);

  let output = `${icon} ${msg}`;

  if (result.fixable) {
    output += ` ${chalk.dim('[fixable]')}`;
  }

  if (verbose && result.details && result.details.length > 0) {
    output += '\n' + result.details.map((d) => `    ${chalk.dim('•')} ${chalk.gray(d)}`).join('\n');
  }

  if (result.hint) {
    output += `\n    ${chalk.cyan('Tip:')} ${chalk.dim(result.hint)}`;
  }

  return output;
}

export function formatHealthScore(score: HealthScore): string {
  let scoreColor = chalk.green;
  if (score.percentage < 50) {
    scoreColor = chalk.red;
  } else if (score.percentage < 80) {
    scoreColor = chalk.yellow;
  }

  const scoreText = scoreColor.bold(`${score.percentage}%`);
  const ratingText = chalk.dim(`(${score.rating})`);

  const totalBars = 20;
  const filledBars = Math.round((score.percentage / 100) * totalBars);
  const bar = scoreColor('█'.repeat(filledBars)) + chalk.gray('░'.repeat(totalBars - filledBars));

  return `${chalk.bold('Project Health:')} [${bar}] ${scoreText} ${ratingText}`;
}

export function formatCategorizedHealthScore(score: HealthScore): string {
  const lines: string[] = [];
  lines.push(chalk.bold('Project Health'));
  lines.push(`${'Overall'.padEnd(16)} ${chalk.bold(`${score.percentage}%`)}`);
  lines.push('');

  if (score.categories) {
    for (const [catName, catHealth] of Object.entries(score.categories)) {
      if (!catHealth.applicable) continue;
      let color = chalk.green;
      if (catHealth.percentage < 50) color = chalk.red;
      else if (catHealth.percentage < 80) color = chalk.yellow;

      lines.push(`${catName.padEnd(16)} ${color(`${catHealth.percentage}%`)}`);
    }
  }

  return lines.join('\n');
}

export function renderBanner(title: string, subtitle?: string): string {
  const content = subtitle
    ? `${chalk.bold.cyan(title)}\n${chalk.dim(subtitle)}`
    : chalk.bold.cyan(title);
  return boxen(content, {
    padding: { top: 0, bottom: 0, left: 2, right: 2 },
    margin: { top: 0, bottom: 1 },
    borderColor: 'cyan',
    borderStyle: 'round',
  });
}

export function logError(message: string, error?: unknown): void {
  console.error(chalk.red(`\nError: ${message}`));
  if (error instanceof Error && process.env.DEBUG) {
    console.error(chalk.dim(error.stack));
  }
}
