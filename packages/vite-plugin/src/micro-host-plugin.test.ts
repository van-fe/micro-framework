import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { build } from "vite";
import { microHost } from "./micro-host-plugin";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("microHost", () => {
  it("emits the Realm bootstrap beside host chunks in the configured assets directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "micro-frame-host-plugin-"));
    directories.push(root);
    await writeFile(join(root, "index.html"), '<script type="module" src="/main.js"></script>', "utf8");
    await writeFile(join(root, "main.js"), "window.hostReady = true;", "utf8");
    const bootstrapModule = join(root, "realm-bootstrap-source.js");
    await writeFile(bootstrapModule, "window.realmBootstrapLoaded = true;", "utf8");
    const offlineWorker = join(root, "offline-worker-source.js");
    await writeFile(offlineWorker, "self.offlineWorkerLoaded = true;", "utf8");

    await build({
      root,
      logLevel: "silent",
      build: { assetsDir: "static", outDir: "dist" },
      plugins: [microHost({
        bootstrapModule,
        offlineCache: { workerModule: offlineWorker },
      })],
    });

    await expect(readFile(join(root, "dist/static/realm-bootstrap.js"), "utf8"))
      .resolves.toContain("realmBootstrapLoaded");
    await expect(readFile(join(root, "dist/micro-frame-offline-worker.js"), "utf8"))
      .resolves.toContain("offlineWorkerLoaded");
    await expect(readFile(join(root, "dist/__micro_frame__/realm.html"), "utf8"))
      .resolves.toBe('<!doctype html><html><head><meta charset="utf-8"><title>Micro Frame Realm</title></head><body></body></html>');
  });
});
