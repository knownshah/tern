import type { CheckResult, HealthScore, CategoryHealth } from '../types/index.js';

export const HEALTH_CATEGORIES = [
  'Runtime',
  'Environment',
  'Dependencies',
  'Git',
  'Deployment',
  'Security',
  'AI Agents',
] as const;

export type HealthCategoryName = (typeof HEALTH_CATEGORIES)[number];

export function mapCheckCategoryToHealthCategory(cat: string): HealthCategoryName {
  switch (cat) {
    case 'node':
    case 'runtime':
      return 'Runtime';
    case 'env':
    case 'port':
      return 'Environment';
    case 'package':
    case 'deps':
      return 'Dependencies';
    case 'git':
      return 'Git';
    case 'deploy':
      return 'Deployment';
    case 'security':
      return 'Security';
    case 'agent':
    case 'mcp':
      return 'AI Agents';
    default:
      return 'Environment';
  }
}

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
      categories: {},
    };
  }

  const passed = activeResults.filter((r) => r.status === 'success').length;
  const warnings = activeResults.filter((r) => r.status === 'warning').length;
  const errors = activeResults.filter((r) => r.status === 'error').length;

  // Calculate categorized health scores
  const categoryMap: Record<string, CategoryHealth> = {};
  const activeCategoryScores: number[] = [];

  for (const catName of HEALTH_CATEGORIES) {
    const catResults = activeResults.filter(
      (r) => mapCheckCategoryToHealthCategory(r.category) === catName
    );

    if (catResults.length === 0) {
      categoryMap[catName] = {
        category: catName,
        percentage: 100,
        total: 0,
        passed: 0,
        warnings: 0,
        errors: 0,
        applicable: false,
      };
      continue;
    }

    const catPassed = catResults.filter((r) => r.status === 'success').length;
    const catWarnings = catResults.filter((r) => r.status === 'warning').length;
    const catErrors = catResults.filter((r) => r.status === 'error').length;

    const errorWeight = 20;
    const warningWeight = 8;
    const penalty = catErrors * errorWeight + catWarnings * warningWeight;
    const maxCapacity = catResults.length * errorWeight;

    let catPercentage = Math.max(
      0,
      Math.min(100, Math.round(100 - (penalty / maxCapacity) * 100))
    );

    if (catErrors === 0 && catWarnings === 0) {
      catPercentage = 100;
    } else if (catErrors > 0 && catPercentage > 85) {
      catPercentage = 85;
    }

    categoryMap[catName] = {
      category: catName,
      percentage: catPercentage,
      total: catResults.length,
      passed: catPassed,
      warnings: catWarnings,
      errors: catErrors,
      applicable: true,
    };

    activeCategoryScores.push(catPercentage);
  }

  // Calculate overall score: average of active categories
  let percentage: number;
  if (activeCategoryScores.length > 0) {
    const sum = activeCategoryScores.reduce((acc, val) => acc + val, 0);
    percentage = Math.round(sum / activeCategoryScores.length);
  } else {
    percentage = 100;
  }

  if (errors === 0 && warnings === 0) {
    percentage = 100;
  } else if (errors > 0 && percentage > 85) {
    percentage = 85;
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
    categories: categoryMap,
  };
}
