import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

export interface MicroHostPluginOptions {
  /** Override the Realm bootstrap module when using a custom runtime distribution. */
  bootstrapModule?: string;
  /** Override the emitted path relative to Vite's output directory. */
  bootstrapFile?: string;
  /** Empty same-origin iframe document; align RuntimeOptions.realmDocumentUrl when overriding. */
  realmDocumentFile?: string;
  /** Emit the optional host-owned offline cache Service Worker at the deployment root. */
  offlineCache?: boolean | {
    workerModule?: string;
    workerFile?: string;
  };
}

function bootstrapFileIn(assetsDir: string): string {
  const normalized = assetsDir.replace(/^\/+|\/+$/g, "");
  return normalized ? `${normalized}/realm-bootstrap.js` : "realm-bootstrap.js";
}

/** Emit the external module that creates each iframe Realm's native import boundary. */
export function microHost(options: MicroHostPluginOptions = {}): Plugin {
  let assetsDir = "assets";
  let building = false;
  const realmDocumentFile = options.realmDocumentFile ?? "__micro_frame__/realm.html";
  const realmDocument = '<!doctype html><html><head><meta charset="utf-8"><title>Micro Frame Realm</title></head><body></body></html>';
  return {
    name: "micro-frame:host-bootstrap",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== `/${realmDocumentFile}`) return next();
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(realmDocument);
      });
    },
    configResolved(config) {
      assetsDir = config.build.assetsDir;
      building = config.command === "build";
    },
    async buildStart() {
      if (!building) return;
      this.emitFile({ type: "asset", fileName: realmDocumentFile, source: realmDocument });
      const bootstrapModule = options.bootstrapModule ?? "@micro-framework/realm-host/realm-bootstrap";
      const resolved = await this.resolve(bootstrapModule, fileURLToPath(import.meta.url));
      if (!resolved) {
        this.error(
          `Unable to resolve the Micro Frame Realm bootstrap module: ${bootstrapModule}`,
        );
        return;
      }
      this.emitFile({
        type: "chunk",
        id: resolved.id,
        fileName: options.bootstrapFile ?? bootstrapFileIn(assetsDir),
      });
      if (options.offlineCache) {
        const configuration = typeof options.offlineCache === "object" ? options.offlineCache : {};
        const workerModule = configuration.workerModule ?? "@micro-framework/offline-cache/worker";
        const offlineWorker = await this.resolve(workerModule, fileURLToPath(import.meta.url));
        if (!offlineWorker) {
          this.error(`Unable to resolve the Micro Frame offline worker module: ${workerModule}`);
          return;
        }
        this.emitFile({
          type: "chunk",
          id: offlineWorker.id,
          fileName: configuration.workerFile ?? "micro-frame-offline-worker.js",
        });
      }
    },
  };
}
