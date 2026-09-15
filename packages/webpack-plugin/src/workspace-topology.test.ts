import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execute = promisify(execFile);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const checker = join(root, ".agents/skills/micro-framework-engineering/scripts/check-architecture.ts");

describe("upstream workspace dependency topology", () => {
  it("Q2701 the real workspace package graph remains acyclic", async () => {
    const result = await execute("bun", [checker], { cwd: root, timeout: 10_000 });
    expect(result.stdout).toMatch(/Architecture check passed for \d+ workspace packages/);
  });

  it("Q2701 the same checker rejects mutually dependent workspace packages with the cycle path", async () => {
    const fixture = await mkdtemp(join(tmpdir(), "micro-frame-topology-"));
    try {
      for (const [name, dependency] of [["shared", "sandbox"], ["sandbox", "shared"]]) {
        const directory = join(fixture, "packages", name!);
        await mkdir(directory, { recursive: true });
        await writeFile(join(directory, "package.json"), JSON.stringify({ name: `@micro-framework/${name}`, dependencies: { [`@micro-framework/${dependency}`]: "workspace:*" } }));
      }
      await expect(execute("bun", [checker], { cwd: fixture, timeout: 10_000 })).rejects.toMatchObject({
        code: 1, stderr: expect.stringMatching(/Workspace dependency cycle: @micro-framework\/(sandbox|shared) -> @micro-framework\/(sandbox|shared) -> @micro-framework\/(sandbox|shared)/),
      });
    } finally { await rm(fixture, { recursive: true, force: true }); }
  });
});
