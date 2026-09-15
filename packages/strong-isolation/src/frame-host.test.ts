import { describe, expect, it } from "vitest";
import { normalizeStrongIsolationSandbox, resolveStrongIsolationEntryUrl } from "./frame-host";

describe("strong isolation frame policy", () => {
  it("normalizes explicit least-privilege sandbox tokens", () => {
    expect(normalizeStrongIsolationSandbox("allow-scripts allow-forms allow-scripts"))
      .toBe("allow-forms allow-scripts");
    expect(() => normalizeStrongIsolationSandbox("allow-forms"))
      .toThrow("must include allow-scripts");
    expect(() => normalizeStrongIsolationSandbox("allow-scripts allow-same-origin"))
      .toThrow("forbidden: allow-same-origin");
  });

  it("requires a cross-origin HTTP(S) HTML document", () => {
    expect(resolveStrongIsolationEntryUrl(
      { url: "https://apps.example.com/orders/", type: "html" },
      "https://host.example.com/app/",
      "https://host.example.com",
    )).toBe("https://apps.example.com/orders/");
    expect(() => resolveStrongIsolationEntryUrl(
      { url: "/orders/", type: "html" },
      "https://host.example.com/app/",
      "https://host.example.com",
    )).toThrow("must be cross-origin");
    expect(() => resolveStrongIsolationEntryUrl(
      { url: "https://apps.example.com/entry.js", type: "module" },
      "https://host.example.com/",
      "https://host.example.com",
    )).toThrow("requires an HTML document");
  });
});
