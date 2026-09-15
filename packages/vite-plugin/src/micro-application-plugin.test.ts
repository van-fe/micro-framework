import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { build } from "vite";
import { microApplication } from "./micro-application-plugin";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("microApplication", () => {
  it.each([false, true, "hidden", "inline"] as const)("preserves exports and final-byte integrity (sourcemap=%s)", async (sourcemap) => {
    const root = await mkdtemp(join(tmpdir(), "micro-frame-application-plugin-"));
    directories.push(root);
    const lifecycle = join(root, "lifecycle.js");
    await writeFile(join(root, "index.html"), "<!doctype html><main>host</main>", "utf8");
    await writeFile(
      lifecycle,
      "export function mount() { return 'mounted'; } export function unmount() {}",
      "utf8",
    );

    await build({
      root,
      logLevel: "silent",
      build: { outDir: "dist", sourcemap },
      plugins: [microApplication({ name: "test-application", entry: lifecycle })],
    });

    const manifest = JSON.parse(
      await readFile(join(root, "dist/micro-frame-manifest.json"), "utf8"),
    ) as { entry: string; chunks: Array<{ file: string; integrity: string }> };
    for (const chunk of manifest.chunks) {
      expect(chunk.integrity).toBe(`sha384-${createHash("sha384").update(await readFile(join(root, "dist", chunk.file))).digest("base64")}`);
    }
    const output = await import(`${pathToFileURL(join(root, "dist", manifest.entry)).href}?test`);
    expect(output.mount()).toBe("mounted");
    expect(output.unmount).toBeTypeOf("function");
  });
});
