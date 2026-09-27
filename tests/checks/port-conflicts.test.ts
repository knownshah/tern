import { describe, it, expect } from 'vitest';
import { portConflictsCheck } from '../../src/checks/port-conflicts.js';

describe('checks/port-conflicts', () => {
  it('checks configured ports and returns success when ports are unused', async () => {
    const result = await portConflictsCheck.run({
      cwd: process.cwd(),
      config: { ports: [49152, 49153] }, // IANA dynamic/ephemeral unused range
    });

    expect(result.category).toBe('port');
    expect(['success', 'warning']).toContain(result.status);
  });
});
