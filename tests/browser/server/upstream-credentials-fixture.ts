import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Plugin } from "vite";

type RequestRecord = { path: string; cookie: string; origin: string };

const lifecycle = `
import './dependency.js';
import './preloaded-static.js';
await import('./startup-chunk.js');
export async function mount() {
  await import('./runtime-chunk.js');
  const metadata = [];
  await Promise.all([
    ['script', 'dynamic-classic.js'], ['script', 'dynamic-module.js'],
    ['link', 'dynamic-style.css'], ['script', 'dynamic-override.js'],
  ].map(([tag, path]) => new Promise((resolve, reject) => {
    const element = document.createElement(tag);
    if (path === 'dynamic-module.js') element.type = 'module';
    if (path === 'dynamic-override.js') element.crossOrigin = 'anonymous';
    if (tag === 'link') { element.href = new URL(path, import.meta.url).href; element.rel = 'stylesheet'; }
    else element.src = new URL(path, import.meta.url).href;
    metadata.push([path, element.crossOrigin]);
    element.onload = resolve; element.onerror = () => reject(new Error('resource failed: ' + path));
    document.head.appendChild(element);
  })));
  const preload = document.createElement('link');
  preload.href = new URL('./dynamic-preloaded.js', import.meta.url).href; preload.rel = 'modulepreload';
  metadata.push(['dynamic-preloaded.js', preload.crossOrigin]);
  document.head.appendChild(preload);
  await import('./dynamic-preloaded.js');
  globalThis.__credentialMetadata = metadata;
}
export function unmount() {}
`;

export function upstreamCredentialsFixture(): Plugin {
  let shutdown = (): void => {};
  return {
    name: "upstream-credentials-fixture",
    closeBundle() { shutdown(); },
    async configureServer(vite) {
      const records: RequestRecord[] = [];
      const originServer = createServer((request, response) => {
        const url = new URL(request.url ?? "/", "http://fixture.invalid");
        const requestOrigin = request.headers.origin ?? "";
        response.setHeader("Access-Control-Allow-Origin", requestOrigin || "*");
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setHeader("Cache-Control", "no-store");
        if (url.pathname === "/records") {
          response.setHeader("Content-Type", "application/json");
          response.end(JSON.stringify(records.filter((record) => record.path.includes(url.searchParams.get("case") ?? ""))));
          return;
        }
        records.push({ path: url.pathname, cookie: request.headers.cookie ?? "", origin: requestOrigin });
        const name = url.pathname.split("/").at(-1);
        if (name === "entry.html") {
          response.setHeader("Content-Type", "text/html");
          response.end(`<!doctype html><html><head>
<link rel="stylesheet" href="./static-style.css">
<link rel="modulepreload" href="./preloaded-static.js">
</head><body><script src="./classic.js"></script>
<script>document.write('<script src="./written.js"><\\/script><link rel="stylesheet" href="./written-style.css">');</script>
<script crossorigin src="./static-override.js"></script>
<script type="module" crossorigin="anonymous" src="./module-override.js"></script>
<script type="module" src="./html-module.js"></script></body></html>`);
        } else if (name?.endsWith(".css")) {
          response.setHeader("Content-Type", "text/css");
          response.end("[data-credential-style] { color: rgb(1, 2, 3); }");
        } else {
          response.setHeader("Content-Type", "text/javascript");
          if (name === "entry.js" || name === "html-module.js") response.end(lifecycle);
          else if (name === "dynamic-module.js") response.end("import './dynamic-module-dependency.js'; await import('./dynamic-module-chunk.js');");
          else response.end("globalThis.__credentialExecutions = (globalThis.__credentialExecutions || 0) + 1;");
        }
      });
      await new Promise<void>((resolve, reject) => {
        originServer.once("error", reject);
        originServer.listen(0, "127.0.0.1", () => resolve());
      });
      const origin = `http://127.0.0.1:${(originServer.address() as AddressInfo).port}`;
      shutdown = () => { originServer.closeAllConnections(); originServer.close(); };
      originServer.unref();
      vite.httpServer?.once("close", shutdown);
      vite.middlewares.use((request, response, next) => {
        if (request.url !== "/upstream-credentials-origin") return next();
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ origin }));
      });
    },
  };
}
