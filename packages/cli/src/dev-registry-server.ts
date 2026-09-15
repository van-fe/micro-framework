import { createServer, type IncomingHttpHeaders, type ServerResponse } from "node:http";

export interface DevRegistryApplication {
  readonly name: string;
  readonly entry: string;
  readonly proxy?: {
    readonly prefix: string;
    readonly target: string;
  };
}

export interface DevRegistryServerOptions {
  readonly host?: string;
  readonly port?: number;
  readonly corsOrigin?: string;
  readonly allowRemote?: boolean;
  readonly applications: readonly DevRegistryApplication[];
}

export interface DevRegistryServer {
  readonly url: string;
  readonly registryUrl: string;
  close(): Promise<void>;
}

const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade",
]);

function normalizedPrefix(value: string): string {
  const withLeading = value.startsWith("/") ? value : `/${value}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

function isLoopback(host: string): boolean {
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

function setCors(response: ServerResponse, origin: string): void {
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Accept, Range, If-None-Match, If-Modified-Since");
  if (origin !== "*") response.setHeader("Vary", "Origin");
}

function forwardedHeaders(headers: IncomingHttpHeaders): Headers {
  const forwarded = new Headers();
  for (const name of ["accept", "range", "if-none-match", "if-modified-since"] as const) {
    const value = headers[name];
    if (typeof value === "string") forwarded.set(name, value);
  }
  return forwarded;
}

export async function startDevRegistryServer(
  options: DevRegistryServerOptions,
): Promise<DevRegistryServer> {
  const host = options.host ?? "127.0.0.1";
  if (!options.allowRemote && !isLoopback(host)) {
    throw new Error(`Refusing to bind the development proxy to non-loopback host ${host}.`);
  }
  const port = options.port ?? 5188;
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new TypeError(`Invalid development proxy port ${port}.`);
  const corsOrigin = options.corsOrigin ?? "*";
  const proxies = options.applications
    .filter((application) => application.proxy)
    .map((application) => ({
      application,
      prefix: normalizedPrefix(application.proxy!.prefix),
      target: new URL(application.proxy!.target),
    }))
    .sort((left, right) => right.prefix.length - left.prefix.length);

  let baseURL = "";
  const server = createServer(async (request, response) => {
    setCors(response, corsOrigin);
    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.end();
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.statusCode = 405;
      response.setHeader("Allow", "GET, HEAD, OPTIONS");
      response.end("Method Not Allowed");
      return;
    }
    const requestURL = new URL(request.url ?? "/", baseURL);
    if (requestURL.pathname === "/micro-frame/registry.json") {
      const body = JSON.stringify({
        applications: options.applications.map((application) => ({
          name: application.name,
          entry: application.proxy
            ? new URL(application.entry.replace(/^\//, ""), `${baseURL}${normalizedPrefix(application.proxy.prefix).slice(1)}`).href
            : new URL(application.entry, baseURL).href,
        })),
      }, null, 2);
      response.statusCode = 200;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.end(request.method === "HEAD" ? undefined : body);
      return;
    }
    const proxy = proxies.find(({ prefix }) => requestURL.pathname.startsWith(prefix));
    if (!proxy) {
      response.statusCode = 404;
      response.end("No configured application proxy matches this path.");
      return;
    }
    const suffix = requestURL.pathname.slice(proxy.prefix.length);
    const target = new URL(`${suffix}${requestURL.search}`, proxy.target);
    try {
      const upstream = await fetch(target, {
        method: request.method,
        headers: forwardedHeaders(request.headers),
        redirect: "manual",
      });
      response.statusCode = upstream.status;
      for (const [name, value] of upstream.headers) {
        if (!HOP_BY_HOP.has(name.toLowerCase()) && name.toLowerCase() !== "access-control-allow-origin") {
          response.setHeader(name, value);
        }
      }
      setCors(response, corsOrigin);
      response.setHeader("X-Micro-Frame-Proxy-Target", target.origin);
      if (request.method === "HEAD") response.end();
      else response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      response.statusCode = 502;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({
        error: "upstream-unavailable",
        message: error instanceof Error ? error.message : String(error),
      }));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Unable to resolve the development registry address.");
  }
  const displayHost = address.family === "IPv6" ? `[${address.address}]` : address.address;
  baseURL = `http://${displayHost}:${address.port}/`;
  let closed = false;
  return {
    url: baseURL,
    registryUrl: new URL("micro-frame/registry.json", baseURL).href,
    close: () => new Promise<void>((resolve, reject) => {
      if (closed) { resolve(); return; }
      closed = true;
      server.close((error) => error ? reject(error) : resolve());
    }),
  };
}
