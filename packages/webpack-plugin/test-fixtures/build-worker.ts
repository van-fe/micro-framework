import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MicroApplicationWebpackPlugin } from "@micro-framework/webpack-plugin";
import { compileWebpackFixture } from "../../../tests/support/webpack-compiler.ts";

const source = await mkdtemp(join(tmpdir(), "micro-frame-build-source-"));
try {
  const entry = join(source, "entry.js");
  await writeFile(entry, process.argv[2] === "failure" ? 'import "missing-build-dependency";' : "export function mount() { return 'native module'; }\nexport function unmount() {}\n");
  const result = await compileWebpackFixture({
    entry: { "micro-entry": entry },
    target: "web", experiments: { outputModule: true },
    output: { module: true, library: { type: "module" }, filename: "[name].mjs" },
    plugins: [new MicroApplicationWebpackPlugin({ name: "upstream-build-fixture" })],
  });
  const manifest = JSON.parse(result.assets.get("micro-frame-manifest.json")!.toString()) as { entry: string; application: string };
  console.log(JSON.stringify({ application: manifest.application, entry: manifest.entry, files: [...result.assets.keys()].sort() }));
  await result.dispose();
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
} finally {
  await rm(source, { recursive: true, force: true });
}
