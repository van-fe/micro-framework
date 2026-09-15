import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { Compiler } from "webpack";

export interface MicroHostWebpackOptions {
  readonly bootstrapFile?: string;
  readonly realmDocumentFile?: string;
}
/** Emits an external bootstrap module; pass its public URL to createRuntime({ bootstrapUrl }). */
export class MicroHostWebpackPlugin {
  constructor(private readonly options: MicroHostWebpackOptions = {}) {}
  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap("MicroHostWebpackPlugin", (compilation) => {
      compilation.hooks.processAssets.tapPromise({ name: "MicroHostWebpackPlugin", stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL }, async () => {
        compilation.emitAsset(this.options.realmDocumentFile ?? "__micro_frame__/realm.html", new compiler.webpack.sources.RawSource(
          '<!doctype html><html><head><meta charset="utf-8"><title>Micro Frame Realm</title></head><body></body></html>',
        ));
        const file = createRequire(import.meta.url).resolve("@micro-framework/realm-host/realm-bootstrap");
        const filename = this.options.bootstrapFile ?? "realm-bootstrap.js";
        compilation.fileDependencies.add(file);
        compilation.fileDependencies.add(`${file}.map`);
        // Preserve the prebuilt native module, including its top-level await.
        compilation.emitAsset(filename, new compiler.webpack.sources.RawSource(await readFile(file)), { minimized: true, javascriptModule: true });
        const mapFilename = filename.replace(/[^/]+$/, "realm-bootstrap.js.map");
        compilation.emitAsset(mapFilename, new compiler.webpack.sources.RawSource(await readFile(`${file}.map`)));
      });
    });
  }
}
