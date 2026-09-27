import fs from 'node:fs/promises';
import path from 'node:path';
import type { CheckDefinition, CheckResult, CheckContext } from '../types/index.js';

export const agentConfigCheck: CheckDefinition = {
  id: 'agent-config',
  name: 'AI Agent Instructions',
  category: 'agent',
  description: 'Verifies presence of AI agent instructions (AGENTS.md, CLAUDE.md, GEMINI.md)',
  run: async (context: CheckContext): Promise<CheckResult> => {
    const candidates = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.cursorrules'];
    const found: string[] = [];

    for (const file of candidates) {
      try {
        await fs.access(path.join(context.cwd, file));
        found.push(file);
      } catch {
        // file doesn't exist
      }
    }

    if (found.length > 0) {
      return {
        id: 'agent-config',
        name: 'AI Agent Instructions',
        category: 'agent',
        status: 'success',
        message: `Found AI agent instructions: ${found.join(', ')}`,
        fixable: false,
      };
    }

    return {
      id: 'agent-config',
      name: 'AI Agent Instructions',
      category: 'agent',
      status: 'info',
      message: 'No AI agent instructions found in project',
      hint: 'Add an AGENTS.md or CLAUDE.md file to configure AI coding assistants.',
      fixable: false,
    };
  },
};
