import fs from 'node:fs/promises';
import path from 'node:path';

export interface EnvAnalysis {
  hasEnvExample: boolean;
  hasEnv: boolean;
  exampleKeys: string[];
  envKeys: string[];
  missingKeys: string[];
  extraKeys: string[];
  emptyKeys: string[];
}

/**
 * Extracts only keys from an env file content.
 * Never stores or returns values.
 */
export function extractEnvKeys(content: string): { keys: string[]; emptyKeys: string[] } {
  const keys: string[] = [];
  const emptyKeys: string[] = [];
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    // Match KEY=... or export KEY=...
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (match) {
      const key = match[1];
      const rawVal = match[2].trim();
      if (!keys.includes(key)) {
        keys.push(key);
      }
      if (rawVal === '' || rawVal === '""' || rawVal === "''") {
        if (!emptyKeys.includes(key)) {
          emptyKeys.push(key);
        }
      }
    }
  }

  return { keys, emptyKeys };
}

export async function parseEnvKeysFile(filePath: string): Promise<{
  exists: boolean;
  keys: string[];
  emptyKeys: string[];
}> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const { keys, emptyKeys } = extractEnvKeys(content);
    return { exists: true, keys, emptyKeys };
  } catch {
    return { exists: false, keys: [], emptyKeys: [] };
  }
}

export async function compareEnvFiles(
  cwd: string,
  envExampleName = '.env.example',
  envName = '.env'
): Promise<EnvAnalysis> {
  const examplePath = path.join(cwd, envExampleName);
  const envPath = path.join(cwd, envName);

  const exampleData = await parseEnvKeysFile(examplePath);
  const envData = await parseEnvKeysFile(envPath);

  const exampleKeySet = new Set(exampleData.keys);
  const envKeySet = new Set(envData.keys);

  const missingKeys = exampleData.keys.filter((key) => !envKeySet.has(key));
  const extraKeys = envData.keys.filter((key) => !exampleKeySet.has(key));

  return {
    hasEnvExample: exampleData.exists,
    hasEnv: envData.exists,
    exampleKeys: exampleData.keys,
    envKeys: envData.keys,
    missingKeys,
    extraKeys,
    emptyKeys: envData.emptyKeys,
  };
}

export async function addMissingKeysToEnv(
  cwd: string,
  missingKeys: string[],
  envName = '.env'
): Promise<boolean> {
  if (missingKeys.length === 0) return true;

  const envPath = path.join(cwd, envName);
  let content = '';
  let fileExisted = false;

  try {
    content = await fs.readFile(envPath, 'utf8');
    fileExisted = true;
  } catch {
    // File does not exist yet
  }

  const additions = missingKeys.map((k) => `${k}=# TODO: Add value for ${k}`).join('\n');

  const newContent = fileExisted
    ? content.endsWith('\n')
      ? `${content}\n# Added by Tern CLI:\n${additions}\n`
      : `${content}\n\n# Added by Tern CLI:\n${additions}\n`
    : `# Created by Tern CLI from .env.example\n${additions}\n`;

  await fs.writeFile(envPath, newContent, 'utf8');
  return true;
}
