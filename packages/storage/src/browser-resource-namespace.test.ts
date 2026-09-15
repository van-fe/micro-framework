import { describe, expect, it } from "vitest";
import {
  browserResourceNamespacePrefix,
  resolveBrowserResourceNamespaceOptions,
} from "./browser-resource-namespace";

describe("browser resource namespace configuration", () => {
  it("uses secure defaults without changing legacy Web Storage", () => {
    expect(resolveBrowserResourceNamespaceOptions()).toEqual({
      worker: true,
      localStorage: false,
      sessionStorage: false,
      indexedDB: true,
      broadcastChannel: true,
      sharedWorker: true,
      webLocks: true,
    });
  });

  it("supports explicit all-on and all-off modes", () => {
    expect(Object.values(resolveBrowserResourceNamespaceOptions(true)).every(Boolean)).toBe(true);
    expect(Object.values(resolveBrowserResourceNamespaceOptions(false)).every((value) => !value)).toBe(true);
  });

  it("creates a stable application prefix", () => {
    expect(browserResourceNamespacePrefix("orders")).toBe("micro-app:orders:");
  });
});
