import type {
  SharedDependencyCatalog,
  SharedDependencyRequirements,
} from "@micro-framework/contracts";
import { describe, expect, it } from "vitest";
import {
  resolveSharedDependencies,
  SharedDependencyResolutionError,
  type SharedDependencyResolutionErrorCode,
} from "./index";

const catalog = {
  react: [
    { version: "18.3.1", url: "./vendor/react-18.js" },
    { version: "19.0.0", url: "./vendor/react-19.0.js" },
    {
      version: "19.1.2",
      url: "./vendor/react-19.1.js",
      integrity: "sha384-react191",
      crossOrigin: "anonymous" as const,
    },
  ],
  "shared-utils": [
    { version: "2.0.0", url: "https://cdn.example.com/shared-utils.js" },
  ],
};

describe("resolveSharedDependencies", () => {
  it("selects the highest compatible version for imports and absolute scopes", () => {
    const plan = resolveSharedDependencies({
      imports: { react: "^19.0.0", "shared-utils": "2.x" },
      scopes: { "./legacy/": { react: "^18.0.0" } },
    }, catalog, "https://apps.example.com/orders/index.html");

    expect(plan.importMap).toEqual({
      imports: {
        react: "https://apps.example.com/orders/vendor/react-19.1.js",
        "shared-utils": "https://cdn.example.com/shared-utils.js",
      },
      scopes: {
        "https://apps.example.com/orders/legacy/": {
          react: "https://apps.example.com/orders/vendor/react-18.js",
        },
      },
    });
    expect(plan.selections).toEqual([
      expect.objectContaining({ specifier: "react", version: "19.1.2" }),
      expect.objectContaining({ specifier: "shared-utils", version: "2.0.0" }),
      expect.objectContaining({
        specifier: "react",
        version: "18.3.1",
        scope: "https://apps.example.com/orders/legacy/",
      }),
    ]);
    expect(plan.modulePreloads).toContainEqual({
      href: "https://apps.example.com/orders/vendor/react-19.1.js",
      integrity: "sha384-react191",
      crossOrigin: "anonymous",
    });
    expect(Object.isFrozen(plan.importMap.imports)).toBe(true);
    expect(Object.isFrozen(plan.selections)).toBe(true);
  });

  it("deduplicates identical module preload URLs", () => {
    const plan = resolveSharedDependencies({
      imports: { first: "1.x", second: "1.x" },
    }, {
      first: [{ version: "1.0.0", url: "./vendor/shared.js" }],
      second: [{ version: "1.1.0", url: "./vendor/shared.js" }],
    }, "https://apps.example.com/root/");

    expect(plan.modulePreloads).toEqual([
      { href: "https://apps.example.com/root/vendor/shared.js" },
    ]);
  });

  const failureCases: Array<{
    name: string;
    requirements: SharedDependencyRequirements;
    sourceCatalog: SharedDependencyCatalog;
    code: SharedDependencyResolutionErrorCode;
  }> = [
    {
      name: "invalid ranges",
      requirements: { imports: { react: "not-a-range" } },
      sourceCatalog: catalog,
      code: "invalid-range",
    },
    {
      name: "missing compatible versions",
      requirements: { imports: { react: "^20.0.0" } },
      sourceCatalog: catalog,
      code: "unsatisfied-range",
    },
    {
      name: "duplicate normalized versions",
      requirements: { imports: { react: "*" } },
      sourceCatalog: {
        react: [
          { version: "v19.0.0", url: "./one.js" },
          { version: "19.0.0", url: "./two.js" },
        ],
      },
      code: "duplicate-version",
    },
    {
      name: "invalid prefix targets",
      requirements: { imports: { "pkg/": "1.x" } },
      sourceCatalog: { "pkg/": [{ version: "1.0.0", url: "./pkg.js" }] },
      code: "invalid-prefix-target",
    },
  ];

  it.each(failureCases)("reports $name with typed diagnostics", ({ requirements, sourceCatalog, code }) => {
    expect(() => resolveSharedDependencies(
      requirements,
      sourceCatalog,
      "https://apps.example.com/root/",
    )).toThrow(expect.objectContaining<Partial<SharedDependencyResolutionError>>({ code }));
  });
});
