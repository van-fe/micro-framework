import { describe, expect, it } from "vitest";
import { resolveOfflineRealmDocumentUrl } from "./runtime-resources";

describe("offline native Realm document resources", () => {
  it("uses the host-origin deployment endpoint rather than an application-relative path", () => {
    expect(resolveOfflineRealmDocumentUrl("https://host.example/shell/orders"))
      .toBe("https://host.example/__micro_frame__/realm.html");
  });
  it("preserves custom same-origin document paths and queries while removing navigation fragments", () => {
    expect(resolveOfflineRealmDocumentUrl("https://host.example/shell/orders", "../realm.html?v=2#route"))
      .toBe("https://host.example/realm.html?v=2");
  });
  it("rejects cross-origin and non-HTTP documents instead of caching an unusable Realm", () => {
    expect(() => resolveOfflineRealmDocumentUrl("https://host.example", "https://cdn.example/realm.html")).toThrow(/host's HTTP/);
    expect(() => resolveOfflineRealmDocumentUrl("https://host.example", "about:blank")).toThrow(/host's HTTP/);
  });
});
