import type { ApplicationResourceManifest } from "@micro-framework/contracts";
import { describe, expect, it } from "vitest";
import { createSharedDependencyConflictReport } from "./shared-conflict-report";

function manifest(
  application: string,
  imports: Record<string, string>,
): ApplicationResourceManifest {
  return {
    schemaVersion: 2,
    application,
    chunks: [],
    assets: [],
    sharedDependencies: { imports },
  };
}

describe("createSharedDependencyConflictReport", () => {
  it("reports compatible ranges and major-version conflicts deterministically", () => {
    const report = createSharedDependencyConflictReport([
      manifest("orders", { react: "^19.0.0", zod: "^4.0.0" }),
      manifest("billing", { react: ">=19.1.0 <20", zod: "^3.0.0" }),
    ]);

    expect(report).toEqual({
      applications: ["billing", "orders"],
      dependencies: [
        {
          specifier: "react",
          compatible: true,
          requirements: [
            { application: "billing", range: ">=19.1.0 <20" },
            { application: "orders", range: "^19.0.0" },
          ],
        },
        {
          specifier: "zod",
          compatible: false,
          requirements: [
            { application: "billing", range: "^3.0.0" },
            { application: "orders", range: "^4.0.0" },
          ],
        },
      ],
      hasConflicts: true,
    });
  });
});
