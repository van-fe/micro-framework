import { describe, expect, it, vi } from "vitest";
import type { ResolvedHtmlEntry } from "./types";
import { ResolvedEntryCache } from "./resolved-entry-cache";

function entry(url: string): ResolvedHtmlEntry {
  return { type: "html", url, baseURL: url, template: "", scripts: [], styles: [], modulePreloads: [] };
}

describe("ResolvedEntryCache", () => {
  it("reuses a parsed entry until its key changes", () => {
    const cache = new ResolvedEntryCache();
    const resolved = entry("https://example.test/app");
    cache.store("key", 2, resolved);
    expect(cache.get("key")).toBe(resolved);
    expect(cache.get("other-key")).toBeUndefined();
    expect(cache.size).toBe(1);
  });

  it("evicts least-recently-used entries and clears Runtime ownership", () => {
    const cache = new ResolvedEntryCache({ capacity: 2 });
    cache.store("one", 3, entry("https://example.test/one"));
    cache.store("two", 3, entry("https://example.test/two"));
    expect(cache.get("one")).toBeDefined();
    cache.store("three", 5, entry("https://example.test/three"));
    expect(cache.get("two")).toBeUndefined();
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("expires entries and supports a disabled zero-capacity cache", () => {
    vi.useFakeTimers();
    try {
      const cache = new ResolvedEntryCache({ ttlMs: 10 });
      cache.store("key", 6, entry("https://example.test/app"));
      vi.advanceTimersByTime(11);
      expect(cache.get("key")).toBeUndefined();
      const disabled = new ResolvedEntryCache({ capacity: 0 });
      disabled.store("key", 6, entry("https://example.test/app"));
      expect(disabled.size).toBe(0);
      const oversized = new ResolvedEntryCache({ maxSourceLength: 2 });
      oversized.store("key", 4, entry("https://example.test/app"));
      expect(oversized.size).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("caps reuse by the response lifetime and rejects non-cacheable responses", () => {
    const cache = new ResolvedEntryCache({ ttlMs: 10_000 });
    const resolved = entry("https://example.test/versioned");
    cache.store("no-store", 10, resolved, 0);
    expect(cache.get("no-store")).toBeUndefined();

    vi.useFakeTimers();
    try {
      cache.store("short", 10, resolved, 25);
      vi.advanceTimersByTime(24);
      expect(cache.get("short")).toBe(resolved);
      vi.advanceTimersByTime(1);
      expect(cache.get("short")).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
