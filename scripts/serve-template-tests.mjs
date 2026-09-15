import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer, preview } from "vite";
import { root } from "./workspace-packages.mjs";

const applications = JSON.parse(await readFile(resolve(root, ".artifacts/template-consumers.json"), "utf8"));
const closers = [];
async function close() { await Promise.all(closers.map((closer) => closer())); }
try {
  for (const application of applications) {
    const dev = await createServer({ root: application.directory, server: { host: "127.0.0.1", port: application.devPort, strictPort: true } });
    await dev.listen();
    closers.push(() => dev.close());
    const production = await preview({ root: application.directory, preview: { host: "127.0.0.1", port: application.productionPort, strictPort: true } });
    closers.push(() => new Promise((resolveClose, reject) => production.httpServer.close((error) => error ? reject(error) : resolveClose())));
  }
} catch (error) { await close(); throw error; }
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void close().then(() => process.exit(0)); });
