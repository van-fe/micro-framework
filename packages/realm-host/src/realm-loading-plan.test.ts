import type { ResolvedEntry } from "@micro-framework/entry-resolver";
import { describe, expect, it } from "vitest";
import { createRealmLoadingPlan } from "./realm-loading-plan";

describe("createRealmLoadingPlan", () => {
  it("applies the entry credentials to generated preloads while honoring explicit CORS", () => {
    const entry: ResolvedEntry = {
      type: "html", url: "https://apps.example/index.html", baseURL: "https://apps.example/", template: "", styles: [],
      credentials: "include",
      modulePreloads: [{ href: "https://apps.example/chunk.js" }],
      scripts: [{ type: "module", src: "https://apps.example/anonymous.js", integrity: "sha384-script", crossOrigin: "anonymous", async: false, defer: false, noModule: false }],
    };
    expect(createRealmLoadingPlan(entry, undefined, undefined).modulePreloads).toEqual([
      { href: "https://apps.example/chunk.js", crossOrigin: "use-credentials" },
      { href: "https://apps.example/anonymous.js", integrity: "sha384-script", crossOrigin: "anonymous" },
    ]);
  });

  it("preloads the direct module entry after shared dependencies", () => {
    const entry: ResolvedEntry = {
      type: "module",
      url: "https://apps.example.com/orders/entry.js",
      integrity: "sha384-entry",
      modulePreloads: [],
    };
    const plan = createRealmLoadingPlan(entry, {
      imports: { react: "^19.0.0" },
    }, {
      react: [{ version: "19.1.0", url: "https://cdn.example.com/react.js" }],
    });

    expect(plan.importMap.imports).toEqual({ react: "https://cdn.example.com/react.js" });
    expect(plan.modulePreloads).toEqual([
      { href: "https://cdn.example.com/react.js" },
      { href: "https://apps.example.com/orders/entry.js", integrity: "sha384-entry" },
    ]);
  });

  it("preserves declared preloads without inventing preloads for HTML module scripts", () => {
    const entry: ResolvedEntry = {
      type: "html",
      url: "https://apps.example.com/orders/index.html",
      baseURL: "https://apps.example.com/orders/",
      template: "<main></main>",
      styles: [],
      modulePreloads: [
        { href: "https://apps.example.com/orders/shared.js" },
      ],
      scripts: [{
        type: "module",
        src: "https://apps.example.com/orders/entry.js",
        async: false,
        defer: false,
        noModule: false,
      }, {
        type: "module",
        src: "https://apps.example.com/@vite/client",
        async: false,
        defer: false,
        noModule: false,
      }],
    };

    expect(createRealmLoadingPlan(entry, undefined, undefined).modulePreloads).toEqual([
      { href: "https://apps.example.com/orders/shared.js" },
    ]);
  });

  it("loads direct entries without speculative preloads unless integrity requires one", () => {
    const entry: ResolvedEntry = {
      type: "module", url: "https://apps.example.com/entry.js", modulePreloads: [],
    };
    expect(createRealmLoadingPlan(entry, undefined, undefined).modulePreloads).toEqual([]);
  });

  it("rejects conflicting preload metadata for the same URL", () => {
    const entry: ResolvedEntry = {
      type: "module",
      url: "https://apps.example.com/orders/entry.js",
      integrity: "sha384-entry",
      modulePreloads: [{
        href: "https://apps.example.com/orders/entry.js",
        integrity: "sha384-other",
      }],
    };

    expect(() => createRealmLoadingPlan(entry, undefined, undefined)).toThrow(
      "conflicting integrity or CORS metadata",
    );
  });
});
