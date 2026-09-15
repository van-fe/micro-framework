import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { compileWebpackFixture } from "../support/webpack-compiler";

export async function createWebpackReactFixture(): Promise<{ url: string; requests: string[]; dispose(): Promise<void> }> {
  const built = await compileWebpackFixture({
    mode: "development", devtool: "source-map", target: "web",
    entry: fileURLToPath(new URL("../../examples/component-matrix-app/src/batch02/webpack-react-entry.js", import.meta.url)),
    output: {
      filename: "entry.js", chunkFilename: "[name].chunk.js", publicPath: "auto",
      chunkLoadingGlobal: "webpackChunkBatch02Accessor", library: { name: "__batch02WebpackApp__", type: "window" },
    },
    optimization: { minimize: false },
  });
  built.assets.set("accessor.js", Buffer.from(`
    (() => {
      let chunks = [];
      let writes = 0;
      Object.defineProperty(window, 'webpackChunkBatch02Accessor', {
        configurable: true, enumerable: true,
        get() { return chunks; },
        set(value) { chunks = value; writes++; }
      });
      Object.defineProperty(window, '__batch02ChunkSetterWrites', { get() { return writes; } });
    })();
  `));
  built.assets.set("index.html", Buffer.from('<!doctype html><html><head><script src="./accessor.js"></script><script src="./entry.js"></script></head><body></body></html>'));
  const requests: string[] = [];
  const server = createServer((request, response) => {
    const path = new URL(request.url!, "http://localhost").pathname.slice(1);
    requests.push(path);
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Cache-Control", "no-store");
    const asset = built.assets.get(path);
    if (!asset) { response.writeHead(404); response.end("Missing webpack fixture asset"); return; }
    response.setHeader("Content-Type", path.endsWith(".html") ? "text/html" : path.endsWith(".map") ? "application/json" : "text/javascript");
    response.end(asset);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/index.html`, requests,
    async dispose() { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); await built.dispose(); },
  };
}
