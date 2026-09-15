import { describe, expect, it } from "vitest";
import { selectRolloutVariant, type RolloutPolicy } from "./rollout";
import { ServerApplicationRegistry } from "./server-registry";
const policy: RolloutPolicy = {
  salt: "orders-release", stickiness: "tenant",
  variants: [{ id: "stable", weight: 9000, entry: "/v1.js" }, { id: "canary", weight: 1000, entry: "/v2.js" }],
};
describe("server rollout selection", () => {
  it("assigns stable tenant cohorts across users and covers weighted variants", () => {
    const count = { stable: 0, canary: 0 };
    for (let i = 0; i < 10_000; i++) {
      const context = { tenantId: `tenant-${i}`, userId: "a" };
      const selected = selectRolloutVariant(policy, context);
      expect(selectRolloutVariant(policy, { ...context, userId: "b" }).id).toBe(selected.id);
      count[selected.id as keyof typeof count]++;
    }
    expect(count.canary).toBeGreaterThan(800);
    expect(count.canary).toBeLessThan(1200);
  });
  it("uses targeting rules before weights and rejects unknown identities", () => {
    const targeted = { ...policy, rules: [{ variantId: "canary", userIds: ["tester"] }] };
    expect(selectRolloutVariant(targeted, { userId: "tester" }).id).toBe("canary");
    expect(() => selectRolloutVariant(targeted, {})).toThrow("tenantId");
    expect(() => selectRolloutVariant({ ...policy, variants: [{ ...policy.variants[0]!, weight: 9999 }] }, {})).toThrow("10000");
  });
  it("supports immediate rollback and excludes policy identities from client bootstrap", () => {
    const registry = new ServerApplicationRegistry();
    registry.register([{ name: "orders", entry: "/v1.js", container: "#slot", rollout: {
      ...policy, variants: policy.variants.map((variant) => ({ ...variant, weight: variant.id === "stable" ? 10000 : 0 })),
    } }]);
    const bootstrap = registry.createBootstrap({}, { tenantId: "secret-tenant" });
    expect(bootstrap.applications[0]?.entry).toBe("/v1.js");
    expect(bootstrap.applications[0]?.selectedVersion).toBe("stable");
    expect(JSON.stringify(bootstrap)).not.toMatch(/secret-tenant|rollout|variants/);
  });
});
