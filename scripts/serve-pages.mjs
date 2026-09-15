import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { root } from "./workspace-packages.mjs";

const directory = resolve(root, "packages/docs/.vitepress/dist");
const base = process.env.DOCS_BASE || "/micro-framework/";
const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (!pathname.startsWith(base)) { response.writeHead(404).end(); return; }
    let path = resolve(directory, pathname.slice(base.length));
    if (path !== directory && !path.startsWith(directory + sep)) { response.writeHead(403).end(); return; }
    try { if ((await stat(path)).isDirectory()) path = resolve(path, "index.html"); }
    catch { if (!extname(path)) path += ".html"; }
    const body = await readFile(path);
    response.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream" });
    response.end(body);
  } catch { response.writeHead(404).end(); }
});
server.listen(6384, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close(() => process.exit(0)));
