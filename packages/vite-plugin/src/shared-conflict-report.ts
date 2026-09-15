import type { ApplicationResourceManifest } from "@micro-framework/contracts";
import { intersects, validRange } from "semver";

export interface SharedRequirementRecord {
  readonly application: string;
  readonly range: string;
  readonly scope?: string;
}

export interface SharedDependencyConflict {
  readonly specifier: string;
  readonly compatible: boolean;
  readonly requirements: readonly SharedRequirementRecord[];
}

export interface SharedDependencyConflictReport {
  readonly applications: readonly string[];
  readonly dependencies: readonly SharedDependencyConflict[];
  readonly hasConflicts: boolean;
}

export function createSharedDependencyConflictReport(
  manifests: readonly ApplicationResourceManifest[],
): SharedDependencyConflictReport {
  const requirementMap = new Map<string, SharedRequirementRecord[]>();
  const add = (specifier: string, record: SharedRequirementRecord): void => {
    const records = requirementMap.get(specifier) ?? [];
    records.push(record);
    requirementMap.set(specifier, records);
  };
  for (const manifest of manifests) {
    for (const [specifier, range] of Object.entries(manifest.sharedDependencies?.imports ?? {})) {
      add(specifier, { application: manifest.application, range });
    }
    for (const [scope, scoped] of Object.entries(manifest.sharedDependencies?.scopes ?? {})) {
      for (const [specifier, range] of Object.entries(scoped)) {
        add(specifier, { application: manifest.application, range, scope });
      }
    }
  }
  const dependencies = [...requirementMap]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([specifier, records]) => {
      const requirements = records.sort((left, right) =>
        `${left.application}:${left.scope ?? ""}`.localeCompare(`${right.application}:${right.scope ?? ""}`),
      );
      const compatible = requirements.every((left, index) => {
        const leftRange = validRange(left.range);
        return Boolean(leftRange) && requirements.slice(index + 1).every((right) => {
          const rightRange = validRange(right.range);
          return Boolean(rightRange && intersects(leftRange!, rightRange));
        });
      });
      return { specifier, compatible, requirements };
    });
  return {
    applications: manifests.map(({ application }) => application).sort(),
    dependencies,
    hasConflicts: dependencies.some(({ compatible }) => !compatible),
  };
}
