import { createServer } from "node:http";
import { startOfflineHostServer } from "./offline-host-server.mjs";

let resourceAvailable = true;
let networkOffline = false;
startOfflineHostServer(() => networkOffline);

const corsHeaders = {
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
};

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:4275");
  response.setHeader("access-control-allow-origin", corsHeaders["access-control-allow-origin"]);
  response.setHeader("cache-control", corsHeaders["cache-control"]);
  if (url.pathname === "/control") {
    resourceAvailable = url.searchParams.get("available") !== "0";
    if (url.searchParams.has("network")) networkOffline = url.searchParams.get("network") === "0";
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ resourceAvailable, networkOffline }));
    return;
  }
  if (networkOffline) { request.socket.destroy(); return; }
  if (url.pathname === "/offline-fixture.js" || url.pathname === "/offline-dependency.js") {
    if (!resourceAvailable) {
      response.statusCode = 503;
      response.end("fixture origin unavailable");
      return;
    }
    response.setHeader("content-type", "text/javascript; charset=utf-8");
    response.end(url.pathname === "/offline-dependency.js"
      ? 'export const label = "Offline mounted application";\n'
      : `import { label } from './offline-dependency.js';
         export const offlineFixture = "micro-frame-offline-cache";
         let root;
         window.__offlineFixtureExecutions = (window.__offlineFixtureExecutions || 0) + 1;
         export function mount(props) {
           root = document.createElement('button');
           root.dataset.offlineExecution = String(window.__offlineFixtureExecutions);
           root.textContent = label;
           root.onclick = () => { root.textContent = label + ': clicked'; };
           props.container.append(root);
         }
         export function unmount() { root?.remove(); root = undefined; }
      `);
    return;
  }
  response.statusCode = 404;
  response.end("not found");
}).listen(4275, "127.0.0.1");
