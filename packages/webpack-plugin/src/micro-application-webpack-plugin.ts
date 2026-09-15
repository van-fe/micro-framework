import { createHash } from "node:crypto";
import type { Compiler, Chunk } from "webpack";
import type { ApplicationResourceManifest, SharedDependencyRequirements } from "@micro-framework/contracts";

export interface MicroApplicationWebpackOptions {
  readonly name: string;
  readonly entryName?: string;
  readonly manifestFile?: string;
  readonly sharedDependencies?: SharedDependencyRequirements;
}
export class MicroApplicationWebpackPlugin {
  constructor(private readonly options: MicroApplicationWebpackOptions) {
    if (!options.name.trim()) throw new TypeError("Application name is required.");
  }
  apply(compiler: Compiler): void {
    if (!compiler.options.experiments.outputModule || !compiler.options.output.module || compiler.options.output.library?.type !== "module") {
      throw new Error("Micro applications require experiments.outputModule, output.module and output.library.type = module.");
    }
    compiler.hooks.thisCompilation.tap("MicroApplicationWebpackPlugin", (compilation) => {
      compilation.hooks.processAssets.tap({ name: "MicroApplicationWebpackPlugin", stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT }, () => {
        const entrypoint = compilation.entrypoints.get(this.options.entryName ?? "micro-entry");
        if (!entrypoint) throw new Error("Micro application entrypoint was not emitted.");
        const entryChunk = entrypoint.getEntrypointChunk();
        const files = (chunks: Iterable<Chunk>) => [...chunks].flatMap((chunk) => [...chunk.files].filter((file) => /\.[cm]?js$/.test(file)));
        const entry = files([entryChunk])[0];
        if (!entry) throw new Error("Micro application entry has no JavaScript output.");
        const integrity = (file: string) => `sha384-${createHash("sha384").update(compilation.getAsset(file)!.source.buffer()).digest("base64")}`;
        const chunkFiles = new Set(files(compilation.chunks));
        const manifest: ApplicationResourceManifest = {
          schemaVersion: 2, application: this.options.name, entry,
          chunks: [...compilation.chunks].flatMap((chunk) => files([chunk]).map((file) => ({
            file, entry: file === entry, integrity: integrity(file),
            imports: files(chunk.getAllInitialChunks()).filter((name) => name !== file).sort(),
            dynamicImports: files(chunk.getAllAsyncChunks()).sort(),
          }))).sort((a, b) => a.file.localeCompare(b.file)),
          assets: compilation.getAssets().filter(({ name }) => !chunkFiles.has(name)).map(({ name }) => ({ file: name, integrity: integrity(name) })).sort((a, b) => a.file.localeCompare(b.file)),
          sharedDependencies: this.options.sharedDependencies,
        };
        compilation.emitAsset(this.options.manifestFile ?? "micro-frame-manifest.json", new compiler.webpack.sources.RawSource(JSON.stringify(manifest, null, 2) + "\n"));
      });
    });
  }
}
