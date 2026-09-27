import chalk from 'chalk';
import { compareEnvFiles, addMissingKeysToEnv } from '../utils/env.js';
import { icons } from '../utils/logger.js';

export interface EnvCommandOptions {
  cwd?: string;
  example?: string;
  env?: string;
  sync?: boolean;
}

export async function envCommand(options: EnvCommandOptions = {}): Promise<number> {
  const cwd = options.cwd || process.cwd();
  const exampleName = options.example || '.env.example';
  const envName = options.env || '.env';

  console.log(chalk.bold(`\nTern Environment Variable Inspector`));
  console.log(chalk.dim(`Comparing: ${exampleName} ↔ ${envName}\n`));

  const analysis = await compareEnvFiles(cwd, exampleName, envName);

  if (!analysis.hasEnvExample && !analysis.hasEnv) {
    console.log(
      chalk.yellow(`${icons.info} Neither ${exampleName} nor ${envName} found in ${cwd}\n`)
    );
    return 0;
  }

  if (!analysis.hasEnvExample) {
    console.log(chalk.yellow(`${icons.warning} ${exampleName} does not exist.`));
    console.log(chalk.dim(`Found ${envName} with ${analysis.envKeys.length} variable keys.`));
    console.log(
      chalk.dim(`Recommendation: Create ${exampleName} as a template for other contributors.\n`)
    );
    return 0;
  }

  if (!analysis.hasEnv) {
    console.log(chalk.red(`${icons.error} ${envName} is missing!`));
    console.log(
      chalk.dim(`Found ${analysis.exampleKeys.length} required variable(s) in ${exampleName}:`)
    );
    for (const key of analysis.exampleKeys) {
      console.log(`  ${chalk.red('✗')} ${chalk.bold(key)}`);
    }

    if (options.sync) {
      console.log(chalk.cyan(`\nSyncing: Creating ${envName} with placeholder keys...`));
      await addMissingKeysToEnv(cwd, analysis.exampleKeys, envName);
      console.log(chalk.green(`✓ Created ${envName} successfully!\n`));
      return 0;
    }

    console.log(chalk.cyan(`\nRun "tern env --sync" or "tern fix" to initialize ${envName}.\n`));
    return 1;
  }

  let hasIssues = false;

  console.log(chalk.bold('Status Summary:'));
  console.log(`  Template (${exampleName}): ${chalk.cyan(analysis.exampleKeys.length)} keys`);
  console.log(`  Local (${envName}): ${chalk.cyan(analysis.envKeys.length)} keys\n`);

  if (analysis.missingKeys.length > 0) {
    hasIssues = true;
    console.log(chalk.red.bold(`Missing Variables (${analysis.missingKeys.length}):`));
    console.log(
      chalk.dim('These keys are defined in the template but missing in your local .env:')
    );
    for (const key of analysis.missingKeys) {
      console.log(`  ${chalk.red('✗')} ${chalk.bold(key)}`);
    }
    console.log();
  } else {
    console.log(
      chalk.green(`${icons.success} All variables from ${exampleName} are defined in ${envName}.`)
    );
  }

  if (analysis.emptyKeys.length > 0) {
    console.log(chalk.yellow.bold(`Empty Variables in ${envName} (${analysis.emptyKeys.length}):`));
    console.log(chalk.dim('These keys are present in .env but currently have empty values:'));
    for (const key of analysis.emptyKeys) {
      console.log(`  ${chalk.yellow('⚠')} ${key}`);
    }
    console.log();
  }

  if (analysis.extraKeys.length > 0) {
    console.log(
      chalk.blue.bold(`Additional Variables in ${envName} (${analysis.extraKeys.length}):`)
    );
    console.log(chalk.dim(`These keys are in .env but not documented in ${exampleName}:`));
    for (const key of analysis.extraKeys) {
      console.log(`  ${chalk.blue('ℹ')} ${key}`);
    }
    console.log();
  }

  if (options.sync && analysis.missingKeys.length > 0) {
    console.log(
      chalk.cyan(`Syncing ${analysis.missingKeys.length} missing key(s) to ${envName}...`)
    );
    await addMissingKeysToEnv(cwd, analysis.missingKeys, envName);
    console.log(chalk.green(`✓ Updated ${envName} with placeholder keys!\n`));
    return 0;
  }

  if (hasIssues) {
    console.log(chalk.dim(`Note: Values are never displayed or logged for security.`));
    console.log(
      chalk.cyan(`Tip: Run "tern env --sync" to append missing variables to ${envName}.\n`)
    );
    return 1;
  }

  console.log(chalk.green.bold(`✓ Environment files are completely in sync!\n`));
  return 0;
}
