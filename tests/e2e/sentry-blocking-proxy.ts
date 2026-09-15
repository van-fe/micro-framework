import { createServer, request as httpRequest, type Server } from "node:http";
import type { Socket } from "node:net";

const port = Number(process.env.MICRO_FRAME_SENTRY_PROXY_PORT ?? 4399);
const fakeReceiverHost = "sentry-guard.invalid";
const delivered = new Map<string, string[]>();
const blocked = new Map<string, string[]>();

function record(target: Map<string, string[]>, session: string | null, value: string): void {
  if (!session) return;
  const values = target.get(session) ?? [];
  values.push(value);
  target.set(session, values);
}

const receiver = createServer((incoming, response) => {
  const url = new URL(incoming.url ?? "/", "http://127.0.0.1");
  record(delivered, url.searchParams.get("session"), url.pathname);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.end("<!doctype html><title>Local telemetry guard probe</title>");
});

await new Promise<void>((resolve, reject) => {
  receiver.once("error", reject);
  receiver.listen(0, "127.0.0.1", resolve);
});
const receiverAddress = receiver.address();
if (!receiverAddress || typeof receiverAddress === "string") throw new Error("Fake receiver did not bind a TCP port.");

const proxy = createServer((incoming, response) => {
  const requestUrl = new URL(incoming.url ?? "/", `http://${incoming.headers.host ?? "invalid"}`);
  if (requestUrl.hostname === "127.0.0.1" && requestUrl.pathname === "/__guard__/health") {
    response.end("ok");
    return;
  }
  if (requestUrl.hostname === "127.0.0.1" && requestUrl.pathname === "/__guard__/stats") {
    const session = requestUrl.searchParams.get("session") ?? "";
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ delivered: delivered.get(session) ?? [], blocked: blocked.get(session) ?? [] }));
    return;
  }
  const session = requestUrl.searchParams.get("session");
  if (requestUrl.hostname === fakeReceiverHost && requestUrl.pathname === "/guard.html") {
    const forwarded = httpRequest({
      hostname: "127.0.0.1",
      port: receiverAddress.port,
      path: `${requestUrl.pathname}${requestUrl.search}`,
      method: incoming.method,
      headers: incoming.headers,
    }, (received) => {
      response.writeHead(received.statusCode ?? 200, received.headers);
      received.pipe(response);
    });
    forwarded.on("error", (error) => response.destroy(error));
    incoming.pipe(forwarded);
    return;
  }
  record(blocked, session, requestUrl.pathname);
  response.writeHead(502, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
  response.end("Blocked by local Sentry telemetry guard");
});

proxy.on("connect", (incoming, socket: Socket) => {
  const target = incoming.url ?? "unknown";
  record(blocked, null, `CONNECT ${target}`);
  socket.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
});

await new Promise<void>((resolve, reject) => {
  proxy.once("error", reject);
  proxy.listen(port, "127.0.0.1", resolve);
});

async function close(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

const shutdown = async () => {
  await Promise.all([close(proxy), close(receiver)]);
  process.exit(0);
};
process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
