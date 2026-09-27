import semver from 'semver';
import type { EnvironmentSnapshot } from '../snapshot/types.js';
import type { DiffReport, EnvironmentDifference } from './types.js';

export function compareSnapshots(
  source: EnvironmentSnapshot,
  target: EnvironmentSnapshot,
  sourceName = 'Local',
  targetName = 'Server'
): DiffReport {
  const differences: EnvironmentDifference[] = [];

  // 1. Node runtime comparison
  const srcNode = source.runtime?.node || '';
  const tgtNode = target.runtime?.node || '';

  if (srcNode && tgtNode && srcNode !== tgtNode) {
    const cleanSrc = semver.clean(srcNode) || srcNode;
    const cleanTgt = semver.clean(tgtNode) || tgtNode;
    const srcMajor = semver.major(cleanSrc, { loose: true });
    const tgtMajor = semver.major(cleanTgt, { loose: true });

    const isMajorDiff = isNaN(srcMajor) || isNaN(tgtMajor) ? true : srcMajor !== tgtMajor;

    differences.push({
      property: 'Node',
      sourceValue: srcNode.replace(/^v/, ''),
      targetValue: tgtNode.replace(/^v/, ''),
      severity: isMajorDiff ? 'blocking' : 'warning',
      category: 'runtime',
      message: isMajorDiff
        ? 'Major Node.js version difference may cause runtime syntax or API breakage'
        : 'Minor Node.js version difference',
    });
  }

  // 2. Package manager comparison
  const srcPM = source.packageManager;
  const tgtPM = target.packageManager;

  if (srcPM && tgtPM) {
    if (srcPM.name !== tgtPM.name) {
      differences.push({
        property: 'Package Manager',
        sourceValue: srcPM.name,
        targetValue: tgtPM.name,
        severity: 'warning',
        category: 'packageManager',
        message: 'Different package manager may cause lockfile or hoisting discrepancies',
      });
    } else if (srcPM.version && tgtPM.version && srcPM.version !== tgtPM.version) {
      differences.push({
        property: srcPM.name,
        sourceValue: srcPM.version,
        targetValue: tgtPM.version,
        severity: 'warning',
        category: 'packageManager',
        message: `${srcPM.name} version difference`,
      });
    }
  }

  // 3. Environment Variables (present / missing)
  const srcKeys = new Set(source.environment?.keysPresent || []);
  const tgtKeys = new Set(target.environment?.keysPresent || []);

  // Keys in source that are missing in target
  for (const key of srcKeys) {
    if (!tgtKeys.has(key)) {
      differences.push({
        property: key,
        sourceValue: 'present',
        targetValue: 'missing',
        severity: 'blocking',
        category: 'env',
        message: `Variable ${key} is present in ${sourceName} but missing in ${targetName}`,
      });
    }
  }

  // Keys in target that are missing in source
  for (const key of tgtKeys) {
    if (!srcKeys.has(key)) {
      differences.push({
        property: key,
        sourceValue: 'missing',
        targetValue: 'present',
        severity: 'info',
        category: 'env',
        message: `Variable ${key} is present in ${targetName} but not in ${sourceName}`,
      });
    }
  }

  // 4. Ports comparison
  const srcPortsMap = new Map((source.ports || []).map((p) => [p.port, p]));
  const tgtPortsMap = new Map((target.ports || []).map((p) => [p.port, p]));

  const allPorts = Array.from(new Set([...srcPortsMap.keys(), ...tgtPortsMap.keys()])).sort(
    (a, b) => a - b
  );

  for (const port of allPorts) {
    const srcP = srcPortsMap.get(port);
    const tgtP = tgtPortsMap.get(port);

    const srcStatus = srcP?.status || 'free';
    const tgtStatus = tgtP?.status || 'free';

    if (srcStatus !== tgtStatus) {
      differences.push({
        property: `Port ${port}`,
        sourceValue: srcStatus,
        targetValue: tgtStatus,
        severity: tgtStatus === 'occupied' ? 'blocking' : 'info',
        category: 'port',
        message:
          tgtStatus === 'occupied'
            ? `Port ${port} is occupied on ${targetName} (${tgtP?.process || 'unknown process'})`
            : `Port ${port} is occupied on ${sourceName}`,
      });
    }
  }

  // 5. Architecture & OS differences
  const srcArch = source.os?.arch || '';
  const tgtArch = target.os?.arch || '';

  if (srcArch && tgtArch && srcArch !== tgtArch) {
    differences.push({
      property: 'Architecture',
      sourceValue: srcArch,
      targetValue: tgtArch,
      severity: 'info',
      category: 'os',
      message: 'Different CPU architecture (e.g. native modules must be rebuilt)',
    });
  }

  const srcPlatform = source.os?.platform || '';
  const tgtPlatform = target.os?.platform || '';

  if (srcPlatform && tgtPlatform && srcPlatform !== tgtPlatform) {
    differences.push({
      property: 'OS Platform',
      sourceValue: srcPlatform,
      targetValue: tgtPlatform,
      severity: 'info',
      category: 'os',
      message: 'Different operating system platform',
    });
  }

  // 6. Project & Framework differences
  if (
    source.project?.framework &&
    target.project?.framework &&
    source.project.framework !== target.project.framework
  ) {
    differences.push({
      property: 'Framework',
      sourceValue: source.project.framework,
      targetValue: target.project.framework,
      severity: 'blocking',
      category: 'runtime',
      message: 'Different framework detected',
    });
  }

  // Summary counts
  const informational = differences.filter((d) => d.severity === 'info').length;
  const warnings = differences.filter((d) => d.severity === 'warning').length;
  const blocking = differences.filter((d) => d.severity === 'blocking').length;

  return {
    sourceName,
    targetName,
    summary: {
      total: differences.length,
      informational,
      warnings,
      blocking,
    },
    differences,
  };
}
