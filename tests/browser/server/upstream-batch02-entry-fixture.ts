import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import type { Plugin } from "vite";
import { compileWebpackFixture } from "../../support/webpack-compiler";

export const batch02InlineSource = "window.batch02InlineText = document.currentScript.textContent;\nwindow.Batch02Inline = { mount() {}, unmount() {} };";
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="rgb(17, 34, 51)"/></svg>';

export function upstreamBatch02EntryFixture(): Plugin {
  let shutdown = async (): Promise<void> => {};
  return { name: "upstream-batch02-entry-fixture", closeBundle() { return shutdown(); }, async configureServer(vite) {
    const bundle = await compileWebpackFixture({
      entry: fileURLToPath(new URL("../../fixtures/upstream-batch02-webpack/entry.cjs", import.meta.url)),
      output: { filename: "main.js", chunkFilename: "[id].[contenthash].js", publicPath: "auto", library: { name: "Batch02Webpack", type: "window" } },
    });
    const requests: string[] = [];
    const server = createServer(async (request, response) => {
      const url = new URL(request.url ?? "/", "http://fixture.invalid");
      requests.push(request.url ?? "/");
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Cache-Control", "no-store");
      let body: string | Buffer;
      let type = "text/html";
      if (url.pathname === "/webpack.html") {
        body = '<!doctype html><html><body><script type="application/json" id="app-config">{"value":"original"}</script><script src="/webpack/main.js"></script></body></html>';
      } else if (url.pathname.startsWith("/webpack/") && bundle.assets.has(url.pathname.slice(9))) {
        body = bundle.assets.get(url.pathname.slice(9))!; type = "text/javascript";
      } else if (url.pathname === "/query.html") {
        body = '<!doctype html><script src="/query.js?ts=20260908&amp;type=adguard&amp;value=a%2Fb%26c&amp;other=%252F"></script>';
      } else if (url.pathname === "/query.js") {
        type = "text/javascript";
        body = "window.batch02Query = Object.fromEntries(new URL(document.currentScript.src).searchParams); window.Batch02Query = { mount() {}, unmount() {} };";
      } else if (url.pathname === "/inline.html") {
        body = `<script>${batch02InlineSource}</script>`;
      } else if (url.pathname === "/external.html") {
        body = '<script src="/external-stack.js"></script>';
      } else if (url.pathname === "/external-stack.js") {
        type = "text/javascript";
        body = 'window.batch02Stack = new Error("native external script").stack; window.Batch02External = { mount() {}, unmount() {} };';
      } else if (url.pathname === "/assets.html") {
        body = '<html data-theme="dark" style="font-size:20px"><body class="asset-body" style="background-image:url(/pixel.svg)"><div id="asset-static" style="width:8px;height:8px;background-image:url(/pixel.svg)"></div><script src="/assets.js"></script></body></html>';
      } else if (url.pathname === "/assets.js") {
        type = "text/javascript";
        body = "window.Batch02Assets = { mount() {}, unmount() {} };";
      } else if (url.pathname === "/pixel.svg") {
        body = svg; type = "image/svg+xml";
      } else if (url.pathname === "/native.html") {
        body = '<script src="/native.js"></script>';
      } else if (url.pathname === "/native.js") {
        type = "text/javascript";
        body = await readFile(new URL("../fixtures/upstream-batch02-native-probe.js", import.meta.url), "utf8");
      } else if (url.pathname === "/navigation-target.html") {
        body = '<!doctype html><title>Native child navigation target</title><p>Child navigation completed</p>';
      } else if (url.pathname === "/script-query.html") {
        body = '<!doctype html><html><head><script src="/script-query-first.js"></script><script src="/script-query-second.js"></script></head><body></body></html>';
      } else if (url.pathname === "/script-query-first.js" || url.pathname === "/script-query-second.js") {
        type = "text/javascript";
        body = await readFile(new URL(`../fixtures/upstream-batch02-${url.pathname.slice(1)}`, import.meta.url), "utf8");
      } else if (url.pathname === "/cross-message.html") {
        body = '<!doctype html><script src="/cross-message-app.js"></script>';
      } else if (url.pathname === "/cross-message-child.html") {
        body = '<!doctype html><title>Cross-origin message child</title><script src="/cross-message-child.js"></script>';
      } else if (url.pathname === "/cross-message-app.js" || url.pathname === "/cross-message-child.js") {
        type = "text/javascript";
        body = await readFile(new URL(`../fixtures/upstream-batch02-${url.pathname.slice(1)}`, import.meta.url), "utf8");
      } else if (url.pathname === "/csp.html") {
        body = '<!doctype html><html><head><link rel="stylesheet" href="/csp.css"></head><body><script src="/csp.js"></script></body></html>';
      } else if (url.pathname === "/csp-nonce.html") {
        const nonce = url.searchParams.get("allowed") === "1" ? ' nonce="batch02-authorized"' : "";
        body = `<!doctype html><html><head><style${nonce}>:root { --csp-author-color: rgb(70, 90, 110); } .csp-nonce-probe { color: var(--csp-author-color); width: 37px; }</style></head><body><script src="/csp-nonce.js"></script></body></html>`;
      } else if (url.pathname === "/csp-nonce.js") {
        type = "text/javascript";
        body = "window.Batch02Nonce = { mount(props) { const node = document.createElement('button'); node.className = 'csp-nonce-probe'; node.textContent = 'Nonce probe'; props.container.appendChild(node); }, unmount(props) { props.container.replaceChildren(); } };";
      } else if (url.pathname === "/csp.css") {
        type = "text/css"; body = 'button { color: rgb(12, 34, 56); }';
      } else if (url.pathname === "/csp.js") {
        type = "text/javascript";
        body = "window.Batch02Csp = { mount(props) { let count = 0; const button = document.createElement('button'); button.textContent = 'CSP count: 0'; button.onclick = () => { button.textContent = 'CSP count: ' + ++count; }; props.container.appendChild(button); }, unmount(props) { props.container.replaceChildren(); } };";
      } else if (url.pathname === "/jsplumb.html") {
        body = '<!doctype html><script src="/jsplumb-library.js"></script><script src="/jsplumb-app.js"></script>';
      } else if (url.pathname === "/jsplumb-library.js") {
        type = "text/javascript"; body = await readFile(createRequire(import.meta.url).resolve("jsplumb"));
      } else if (url.pathname === "/jsplumb-app.js") {
        type = "text/javascript"; body = await readFile(new URL("../fixtures/upstream-batch02-jsplumb-app.js", import.meta.url));
      } else if (url.pathname === "/requests") {
        body = JSON.stringify(requests); type = "application/json";
      } else {
        response.statusCode = 404; body = "Unknown batch02 fixture";
      }
      response.setHeader("Content-Type", type);
      response.end(body);
    });
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    vite.middlewares.use((request, response, next) => {
      if (["/__batch02-csp-host.html", "/__batch02-csp-nonce-host.html"].includes(request.url?.split("?")[0] ?? "")) {
        response.setHeader("Content-Type", "text/html");
        response.setHeader("Content-Security-Policy", "style-src 'self' http://127.0.0.1:*" + (request.url?.startsWith("/__batch02-csp-nonce-host.html") ? " 'nonce-batch02-authorized'" : ""));
        response.end('<!doctype html><html><head><title>CSP compatibility</title></head><body><script type="module" src="/src/benchmark.ts"></script><main id="csp-slot"></main></body></html>');
        return;
      }
      if (request.url?.split("?")[0] !== "/__batch02-entry") return next();
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ origin }));
    });
    let closed = false;
    shutdown = async () => { if (closed) return; closed = true; server.closeAllConnections(); server.close(); await bundle.dispose(); };
    server.unref();
    vite.httpServer?.once("close", () => { void shutdown(); });
  } };
}
