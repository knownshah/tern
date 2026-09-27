import { describe, it, expect } from 'vitest';
import { calculateHealthScore } from '../../src/utils/health.js';
import type { CheckResult } from '../../src/types/index.js';

describe('utils/health', () => {
  it('returns 100% and Excellent when all checks succeed', () => {
    const results: CheckResult[] = [
      {
        id: 'c1',
        name: 'Check 1',
        category: 'node',
        status: 'success',
        message: 'Pass',
        fixable: false,
      },
      {
        id: 'c2',
        name: 'Check 2',
        category: 'git',
        status: 'success',
        message: 'Pass',
        fixable: false,
      },
    ];

    const score = calculateHealthScore(results);
    expect(score.percentage).toBe(100);
    expect(score.rating).toBe('Excellent');
    expect(score.passed).toBe(2);
    expect(score.errors).toBe(0);
    expect(score.warnings).toBe(0);
  });

  it('deducts points for warnings and errors', () => {
    const results: CheckResult[] = [
      {
        id: 'c1',
        name: 'Check 1',
        category: 'node',
        status: 'success',
        message: 'Pass',
        fixable: false,
      },
      {
        id: 'c2',
        name: 'Check 2',
        category: 'deps',
        status: 'warning',
        message: 'Outdated',
        fixable: false,
      },
      {
        id: 'c3',
        name: 'Check 3',
        category: 'env',
        status: 'error',
        message: 'Missing env',
        fixable: true,
      },
    ];

    const score = calculateHealthScore(results);
    expect(score.percentage).toBeLessThan(85);
    expect(score.errors).toBe(1);
    expect(score.warnings).toBe(1);
    expect(score.passed).toBe(1);
  });

  it('handles empty results gracefully', () => {
    const score = calculateHealthScore([]);
    expect(score.percentage).toBe(100);
    expect(score.rating).toBe('Excellent');
  });
});
