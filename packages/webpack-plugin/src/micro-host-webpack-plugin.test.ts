import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { compileWebpackFixture } from "../../../tests/support/webpack-compiler";
import { MicroHostWebpackPlugin } from "./micro-host-webpack-plugin";

it("emits the native Realm HTML document and external bootstrap through a real Webpack compilation", async () => {
  const source = await mkdtemp(join(tmpdir(), "micro-frame-webpack-host-"));
  try {
    const entry = join(source, "host.js");
    await writeFile(entry, 'document.documentElement.dataset.host = "ready";');
    const result = await compileWebpackFixture({
      entry, target: "web", optimization: { minimize: false }, output: { filename: "host.js" },
      plugins: [new MicroHostWebpackPlugin()],
    });
    try {
      expect(result.stats.hasErrors()).toBe(false);
      expect(result.assets.get("__micro_frame__/realm.html")?.toString()).toBe(
        '<!doctype html><html><head><meta charset="utf-8"><title>Micro Frame Realm</title></head><body></body></html>',
      );
      expect(result.assets.get("realm-bootstrap.js")?.toString()).toContain("__MICRO_FRAME_BOOTSTRAP__");
      expect(result.assets.get("realm-bootstrap.js")?.toString()).toContain("await");
      expect(JSON.parse(result.assets.get("realm-bootstrap.js.map")!.toString())).toMatchObject({ version: 3 });
    } finally { await result.dispose(); }
  } finally { await rm(source, { recursive: true, force: true }); }
}, 15_000);
