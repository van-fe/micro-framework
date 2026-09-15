import { describe, expect, it } from "vitest";
import { discoverGlobalLifecycle, normalizeLifecycle } from "./lifecycle-discovery";

const lifecycle = { mount() {}, unmount() {} };

describe("HTML lifecycle discovery", () => {
  it("ignores self-referencing and cyclic defaults in unrelated library globals", () => {
    const self: { default?: unknown } = {};
    self.default = self;
    const first = { default: {} };
    first.default = { default: first };
    const globals = { self, first, app: lifecycle } as unknown as Window;
    expect(discoverGlobalLifecycle(globals, new Set(), "/entry")).toBe(lifecycle);
  });

  it("normalizes and deduplicates nested wrappers of the same lifecycle", () => {
    const wrapped = { default: { default: lifecycle } };
    expect(normalizeLifecycle(wrapped)).toBe(lifecycle);
    expect(discoverGlobalLifecycle({ app: lifecycle, wrapped } as unknown as Window,
      new Set(), "/entry")).toBe(lifecycle);
  });

  it("ignores unrelated throwing getters but rejects missing or ambiguous lifecycles", () => {
    const guarded = { get default(): unknown { throw new Error("unavailable"); } };
    expect(discoverGlobalLifecycle({ guarded, app: lifecycle } as unknown as Window,
      new Set(), "/entry")).toBe(lifecycle);
    expect(() => normalizeLifecycle(guarded)).toThrow("mount and unmount");
    expect(() => discoverGlobalLifecycle({} as Window, new Set(), "/entry"))
      .toThrow("did not expose");
    expect(() => discoverGlobalLifecycle({ a: lifecycle, b: { ...lifecycle } } as unknown as Window,
      new Set(), "/entry")).toThrow("multiple lifecycle candidates");
  });
});
