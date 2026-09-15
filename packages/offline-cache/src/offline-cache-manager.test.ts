import { describe, expect, it } from "vitest";
import {
  normalizeMaxActiveEvictions,
  normalizeOfflineApplication,
} from "./offline-cache-manager";

describe("normalizeOfflineApplication", () => {
  it("resolves, deduplicates, and sorts allowlisted HTTP resources", () => {
    expect(normalizeOfflineApplication({
      name: "orders",
      version: "2026.09.01",
      resources: ["/z.js", "https://cdn.example.com/a.js", "/z.js"],
    }, "https://host.example.com/dashboard", [
      "https://host.example.com",
      "https://cdn.example.com",
    ])).toEqual({
      name: "orders",
      version: "2026.09.01",
      resources: [
        "https://cdn.example.com/a.js",
        "https://host.example.com/z.js",
      ],
    });
  });

  it("rejects empty metadata, non-HTTP URLs, and origins outside the allowlist", () => {
    expect(() => normalizeOfflineApplication({
      name: " ", version: "v1", resources: ["/entry.js"],
    }, "https://host.example.com", ["https://host.example.com"])).toThrow(/Application name/);
    expect(() => normalizeOfflineApplication({
      name: "orders", version: "v1", resources: [],
    }, "https://host.example.com", ["https://host.example.com"])).toThrow(/cannot be empty/);
    expect(() => normalizeOfflineApplication({
      name: "orders", version: "v1", resources: ["data:text/javascript,export{}"],
    }, "https://host.example.com", ["https://host.example.com"])).toThrow(/HTTP/);
    expect(() => normalizeOfflineApplication({
      name: "orders", version: "v1", resources: ["https://blocked.example.com/entry.js"],
    }, "https://host.example.com", ["https://host.example.com"])).toThrow(/not allowed/);
  });
});

describe("normalizeMaxActiveEvictions", () => {
  it("defaults to one bounded LRU eviction and rejects unsafe policy values", () => {
    expect(normalizeMaxActiveEvictions(undefined)).toBe(1);
    expect(normalizeMaxActiveEvictions(0)).toBe(0);
    expect(normalizeMaxActiveEvictions(32)).toBe(32);
    for (const invalid of [-1, 1.5, 33, Number.POSITIVE_INFINITY]) {
      expect(() => normalizeMaxActiveEvictions(invalid)).toThrow(/integer between 0 and 32/);
    }
  });
});
