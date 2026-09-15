import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execute = promisify(execFile);
const worker = fileURLToPath(new URL("../test-fixtures/build-worker.ts", import.meta.url));

describe("upstream webpack build completion", () => {
  it("Q2795 a real plugin compilation closes the compiler and lets its process exit", async () => {
    const result = await execute("bun", ["run", worker, "success"], { timeout: 15_000 });
    const evidence = JSON.parse(result.stdout.trim()) as { application: string; entry: string; files: string[] };
    expect(evidence).toEqual({ application: "upstream-build-fixture", entry: "micro-entry.mjs", files: ["micro-entry.mjs", "micro-entry.mjs.map", "micro-frame-manifest.json"] });
    expect(result.stderr).not.toMatch(/Error:|Unhandled|timed out/);
  }, 20_000);

  it("Q2795 a failing real compilation closes and exits with a concrete build error", async () => {
    await expect(execute("bun", ["run", worker, "failure"], { timeout: 15_000 })).rejects.toMatchObject({
      code: 1, killed: false, stderr: expect.stringContaining("missing-build-dependency"),
    });
  }, 20_000);
});
