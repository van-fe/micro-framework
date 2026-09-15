import type { AppEntry } from "@micro-framework/contracts";

export interface RolloutContext {
  readonly userId?: string;
  readonly tenantId?: string;
}
export interface RolloutVariant {
  readonly id: string;
  /** Basis points, totaling 10,000 across all variants. */
  readonly weight: number;
  readonly entry: AppEntry;
  readonly fallbackEntries?: readonly AppEntry[];
}
export interface RolloutPolicy {
  readonly salt: string;
  readonly stickiness: "user" | "tenant";
  readonly variants: readonly RolloutVariant[];
  /** First matching rule wins; both lists must match when both are present. */
  readonly rules?: readonly {
    readonly variantId: string;
    readonly userIds?: readonly string[];
    readonly tenantIds?: readonly string[];
  }[];
}

export function validateRolloutPolicy(policy: RolloutPolicy): void {
  if (!policy.salt || !["user", "tenant"].includes(policy.stickiness) || !policy.variants.length) {
    throw new TypeError("Rollout requires salt, stickiness and variants.");
  }
  const ids = new Set<string>();
  let total = 0;
  for (const variant of policy.variants) {
    if (!variant.id || ids.has(variant.id) || !Number.isInteger(variant.weight) || variant.weight < 0 || variant.weight > 10_000 || !variant.entry) {
      throw new TypeError("Rollout variants require unique IDs, entries and integer weights in [0, 10000].");
    }
    ids.add(variant.id);
    total += variant.weight;
  }
  if (total !== 10_000) throw new TypeError("Rollout variant weights must total 10000.");
  for (const rule of policy.rules ?? []) {
    if (!ids.has(rule.variantId) || !(rule.userIds?.length || rule.tenantIds?.length)) {
      throw new TypeError("Rollout rules require an existing variant and at least one identity list.");
    }
  }
}

/** Stable FNV-1a bucket; identities remain server-side and are never included in bootstrap JSON. */
export function selectRolloutVariant(policy: RolloutPolicy, context: RolloutContext): RolloutVariant {
  validateRolloutPolicy(policy);
  const rule = policy.rules?.find((candidate) =>
    (!candidate.userIds || Boolean(context.userId && candidate.userIds.includes(context.userId)))
    && (!candidate.tenantIds || Boolean(context.tenantId && candidate.tenantIds.includes(context.tenantId))),
  );
  if (rule) return policy.variants.find((variant) => variant.id === rule.variantId)!;
  const identity = policy.stickiness === "user" ? context.userId : context.tenantId;
  if (!identity) throw new TypeError(`Rollout requires ${policy.stickiness}Id for stable assignment.`);
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(JSON.stringify([policy.salt, policy.stickiness, identity]))) {
    hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  }
  const bucket = hash % 10_000;
  let upper = 0;
  for (const variant of policy.variants) {
    upper += variant.weight;
    if (bucket < upper) return variant;
  }
  throw new Error("Invalid rollout bucket.");
}
