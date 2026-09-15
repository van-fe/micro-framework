import { createServer as createViteServer } from "vite";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const servers = [];
for (const [port, folder] of [[6390, "dist"], [6391, "dist-webpack"]]) {
  const root = resolve(`examples/angular-app/${folder}`);
  const server = createServer(async (request, response) => {
    const file = resolve(root, `.${new URL(request.url, `http://127.0.0.1:${port}`).pathname}`);
    if (!file.startsWith(root + "/")) { response.writeHead(403); response.end(); return; }
    try {
      const bytes = await readFile(file);
      response.writeHead(200, { "access-control-allow-origin": "*", "content-type": extname(file) === ".json" ? "application/json" : "text/javascript" });
      response.end(bytes);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise((resolveListen) => server.listen(port, "127.0.0.1", resolveListen));
  servers.push(server);
}
const host = await createViteServer({
  root: resolve("examples/host"), server: { host: "127.0.0.1", port: 6392, strictPort: true },
  plugins: [{ name: "integration-csp", configureServer(server) {
    server.middlewares.use((_request, response, next) => {
      response.setHeader("Content-Security-Policy", "script-src 'self' http://127.0.0.1:6390 http://127.0.0.1:6391; style-src 'self' 'unsafe-inline'");
      next();
    });
  } }],
});
await host.listen();
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { for (const server of servers) server.close(); void host.close(); });
