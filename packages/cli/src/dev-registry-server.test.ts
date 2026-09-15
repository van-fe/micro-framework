import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { startDevRegistryServer, type DevRegistryServer } from "./dev-registry-server";

const closeCallbacks = new Set<() => Promise<void>>();

async function upstream(): Promise<{ url: string; close(): Promise<void> }> {
  const server = createServer((_request, response) => {
    response.statusCode = 200;
    response.setHeader("Content-Type", "text/javascript; charset=utf-8");
    response.end("export const proxied = true;");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing upstream address.");
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}

function track(server: DevRegistryServer): DevRegistryServer {
  closeCallbacks.add(server.close);
  return server;
}

afterEach(async () => {
  await Promise.all([...closeCallbacks].map((close) => close()));
  closeCallbacks.clear();
});

describe("local development registry and CORS proxy", () => {
  it("serves a registry and proxies only configured asset prefixes with local CORS", async () => {
    const target = await upstream();
    closeCallbacks.add(target.close);
    const server = track(await startDevRegistryServer({
      port: 0,
      applications: [{
        name: "orders",
        entry: "entry.js",
        proxy: { prefix: "/apps/orders/", target: target.url },
      }],
    }));

    const registry = await (await fetch(server.registryUrl)).json() as {
      applications: Array<{ name: string; entry: string }>;
    };
    expect(registry.applications).toEqual([{
      name: "orders",
      entry: new URL("apps/orders/entry.js", server.url).href,
    }]);
    const response = await fetch(registry.applications[0]!.entry);
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("x-micro-frame-proxy-target")).toBe(new URL(target.url).origin);
    expect(await response.text()).toBe("export const proxied = true;");
    expect((await fetch(new URL("not-configured.js", server.url))).status).toBe(404);
  });

  it("refuses a remote bind unless it is explicitly authorized", async () => {
    await expect(startDevRegistryServer({
      host: "0.0.0.0",
      port: 0,
      applications: [],
    })).rejects.toThrow(/non-loopback/);
  });
});
