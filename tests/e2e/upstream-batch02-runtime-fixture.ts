import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test as base } from "./upstream-runtime-fixture";

export interface Deployment {
  url: string;
  version: number;
  missing: boolean;
  requests: string[];
  stop(): Promise<void>;
  start(): Promise<void>;
}

export const test = base.extend<{ deployment: Deployment }>({
  deployment: async ({}, use) => {
    let port = 0;
    const deployment: Deployment = {
      url: "", version: 1, missing: false, requests: [],
      async stop() {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      },
      async start() {
        await new Promise<void>((resolve, reject) => {
          server.once("error", reject);
          server.listen(port, "127.0.0.1", () => { server.off("error", reject); resolve(); });
        });
        port = (server.address() as AddressInfo).port;
        deployment.url = `http://127.0.0.1:${port}/index.html`;
      },
    };
    const server = createServer((request, response) => {
      const path = new URL(request.url!, "http://localhost").pathname;
      deployment.requests.push(path);
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Cache-Control", "no-store");
      if (path === "/navigation-target.html") {
        response.setHeader("Content-Type", "text/html");
        response.end("<!doctype html><title>Child navigation target</title><p>Cross-origin child document</p>");
      } else if (path.endsWith(".html")) {
        response.setHeader("Content-Type", "text/html");
        response.end(`<div id="deployed-root"></div><script type="module" src="./entry.v${deployment.version}.js"></script>`);
      } else if (path.endsWith(".js") && !deployment.missing) {
        response.setHeader("Content-Type", "text/javascript");
        response.end(`
          let count = 0;
          export function mount(props) {
            const button = document.createElement('button');
            const render = () => button.textContent = 'Deployment v${deployment.version}: ' + count;
            button.onclick = () => { count++; render(); };
            render(); props.container.appendChild(button);
          }
          export function unmount(props) { props.container.replaceChildren(); }
        `);
      } else {
        response.statusCode = 404;
        response.end("Old deployment chunk removed");
      }
    });
    await deployment.start();
    try { await use(deployment); }
    finally { if (server.listening) await deployment.stop(); }
  },
});

export { addSlot, expect } from "./upstream-runtime-fixture";
