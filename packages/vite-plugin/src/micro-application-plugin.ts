import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SharedDependencyRequirements } from "@micro-framework/contracts";
import type { Plugin } from "vite";
import {
  createBuildManifest,
  type BuildAssetInput,
  type BuildChunkInput,
  type ManifestSigningOptions,
} from "./build-manifest";

export interface MicroApplicationPluginOptions {
  name: string;
  entry?: string;
  manifestFile?: string;
  sharedDependencies?: SharedDependencyRequirements;
  signing?: ManifestSigningOptions;
}

export function microApplication(options: MicroApplicationPluginOptions): Plugin {
  if (!options.name.trim()) throw new Error("The micro application plugin requires a non-empty name.");

  return {
    name: "micro-frame:application-manifest",
    apply: "build",
    enforce: "post",
    config(config) {
      const input = config.build?.rolldownOptions?.input;
      if (!options.entry || input) {
        return {
          build: {
            rolldownOptions: { preserveEntrySignatures: "exports-only" },
          },
        };
      }
      return {
        build: {
          rolldownOptions: {
            preserveEntrySignatures: "exports-only",
            input: {
              index: "index.html",
              "micro-entry": options.entry,
            },
          },
        },
      };
    },
    generateBundle: { order: "post", handler(_outputOptions, bundle) {
      const chunks: BuildChunkInput[] = [];
      const assets: BuildAssetInput[] = [];
      for (const output of Object.values(bundle)) {
        if (output.type === "chunk") {
          chunks.push({
            fileName: output.fileName,
            isEntry: output.isEntry,
            facadeModuleId: output.facadeModuleId,
            imports: output.imports,
            dynamicImports: output.dynamicImports,
            code: output.code,
          });
        } else {
          assets.push({ fileName: output.fileName, source: output.source });
        }
      }
      const manifest = createBuildManifest(options.name, chunks, assets, options.entry, {
        sharedDependencies: options.sharedDependencies,
        signing: options.signing,
      });
      if (options.entry && !manifest.entry) {
        this.error(
          `The configured micro application entry was not emitted: ${options.entry}. ` +
          "Add it to build.rolldownOptions.input when the project already defines custom inputs.",
        );
      }
      this.emitFile({
        type: "asset",
        fileName: options.manifestFile ?? "micro-frame-manifest.json",
        source: `${JSON.stringify(manifest, null, 2)}\n`,
      });
    } },
    async writeBundle(outputOptions, bundle) {
      if (!outputOptions.dir) return;
      const directory = outputOptions.dir;
      const chunks: BuildChunkInput[] = [];
      const assets: BuildAssetInput[] = [];
      for (const output of Object.values(bundle)) {
        if (output.fileName === (options.manifestFile ?? "micro-frame-manifest.json")) continue;
        if (output.type === "chunk") {
          chunks.push({ fileName: output.fileName, isEntry: output.isEntry, facadeModuleId: output.facadeModuleId,
            imports: output.imports, dynamicImports: output.dynamicImports,
            code: await readFile(resolve(directory, output.fileName), "utf8"),
          });
        } else {
          assets.push({ fileName: output.fileName, source: await readFile(resolve(directory, output.fileName)) });
        }
      }
      const manifest = createBuildManifest(options.name, chunks, assets, options.entry, {
        sharedDependencies: options.sharedDependencies, signing: options.signing,
      });
      await writeFile(resolve(directory, options.manifestFile ?? "micro-frame-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
    },
  };
}
