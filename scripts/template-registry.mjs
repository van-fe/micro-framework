// Test-only registry for unchanged CLI consumers of the locally staged release.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { root } from "./workspace-packages.mjs";

const releaseDirectory = resolve(root, ".artifacts/release");
const release = JSON.parse(await readFile(resolve(releaseDirectory, "manifest.json"), "utf8"));
const packages = new Map();
const tarballs = new Map();
for (const artifact of release.artifacts) {
  const file = resolve(releaseDirectory, artifact.file);
  const bytes = await readFile(file);
  const manifest = JSON.parse(execFileSync("tar", ["-xOf", file, "package/package.json"], { encoding: "utf8" }));
  packages.set(artifact.name, { manifest, file: artifact.file, integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}` });
  tarballs.set(`/tarballs/${artifact.file}`, bytes);
}
let origin;
const server = createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, origin).pathname);
  const bytes = tarballs.get(path);
  if (bytes) {
    response.writeHead(200, { "content-type": "application/octet-stream" });
    response.end(bytes);
    return;
  }
  const item = packages.get(path.slice(1));
  if (!item) { response.writeHead(404); response.end(); return; }
  const { manifest, file, integrity } = item;
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({
    name: manifest.name, "dist-tags": { latest: manifest.version },
    versions: { [manifest.version]: { ...manifest, dist: { tarball: `${origin}/tarballs/${file}`, integrity } } },
  }));
});
server.listen(0, "127.0.0.1", () => {
  origin = `http://127.0.0.1:${server.address().port}`;
  console.log(origin);
});
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close());
