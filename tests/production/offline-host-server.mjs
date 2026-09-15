import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

/** Serve the unmodified production host with a controllable network failure. */
export function startOfflineHostServer(isOffline) {
  const directory = resolve("examples/host/dist");
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
  };
  return createServer(async (request, response) => {
    if (isOffline()) { request.socket.destroy(); return; }
    const url = new URL(request.url ?? "/", "http://127.0.0.1:4277");
    const path = resolve(directory, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`);
    if (!path.startsWith(directory + sep)) { response.writeHead(403).end(); return; }
    try {
      const body = await readFile(path);
      response.writeHead(200, {
        "content-type": contentTypes[extname(path)] ?? "application/octet-stream",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      });
      response.end(body);
    } catch { response.writeHead(404).end("not found"); }
  }).listen(4277, "127.0.0.1");
}
