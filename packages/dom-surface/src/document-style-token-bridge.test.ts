import { describe, expect, it } from "vitest";
import { normalizeDocumentSelector, normalizeDocumentTokenSelector } from "./document-style-token-bridge";

describe("normalizeDocumentTokenSelector", () => {
  it("preserves CSSOM serialization for already normalized selector lists", () => {
    const serialized = ":host, micro-app-body .button, :is(.primary, .secondary)";
    expect(normalizeDocumentSelector(serialized)).toBe(serialized);
    expect(normalizeDocumentSelector(".primary, .secondary")).toBe(".primary, .secondary");
    expect(normalizeDocumentSelector("html, body .button, .secondary")).toBe(":host,micro-app-body .button,.secondary");
  });
  it("maps document roots and body selectors without copying unrelated selectors", () => {
    expect(normalizeDocumentTokenSelector(":root,html.dark,body[data-theme='dense'],.card")).toBe(
      ":host,:host(.dark),micro-app-body[data-theme='dense']",
    );
  });

  it("keeps selector lists and functional conditions intact", () => {
    expect(normalizeDocumentTokenSelector(":root:not(.reduced) body,html[data-theme='dark'] > body")).toBe(
      ":host(:not(.reduced)) micro-app-body,:host([data-theme='dark']) > micro-app-body",
    );
  });

  it("ignores selectors that already work inside the ShadowRoot", () => {
    expect(normalizeDocumentTokenSelector(".button,[data-theme='dark']")).toBeNull();
  });
});
