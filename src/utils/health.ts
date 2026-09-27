import type { CheckResult, HealthScore } from '../types/index.js';

export function calculateHealthScore(results: CheckResult[]): HealthScore {
  const activeResults = results.filter((r) => r.status !== 'skipped' && r.status !== 'info');
  const total = activeResults.length;

  if (total === 0) {
    return {
      percentage: 100,
      total: 0,
      passed: 0,
      warnings: 0,
      errors: 0,
      rating: 'Excellent',
    };
  }

  const passed = activeResults.filter((r) => r.status === 'success').length;
  const warnings = activeResults.filter((r) => r.status === 'warning').length;
  const errors = activeResults.filter((r) => r.status === 'error').length;

  // Each error deducts 20 points, each warning deducts 8 points, normalized
  const errorWeight = 20;
  const warningWeight = 8;
  const penalty = errors * errorWeight + warnings * warningWeight;
  const maxScore = 100;
  const calculated = Math.max(
    0,
    Math.min(100, Math.round(maxScore - (penalty / total) * (100 / errorWeight)))
  );

  // If 0 errors and 0 warnings, 100%
  let percentage = calculated;
  if (errors === 0 && warnings === 0) {
    percentage = 100;
  } else if (errors > 0 && percentage > 85) {
    percentage = 85; // Any error prevents >85%
  }

  let rating: HealthScore['rating'];
  if (percentage >= 90) {
    rating = 'Excellent';
  } else if (percentage >= 75) {
    rating = 'Good';
  } else if (percentage >= 50) {
    rating = 'Fair';
  } else if (percentage >= 25) {
    rating = 'Poor';
  } else {
    rating = 'Critical';
  }

  return {
    percentage,
    total,
    passed,
    warnings,
    errors,
    rating,
  };
}
