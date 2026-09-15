import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test as base } from "@playwright/test";

interface FakeReceiver {
  readonly origin: string;
  readonly requests: string[];
  readonly server: Server;
}

interface SentryGuardFixtures {
  sentryNetworkGuard: void;
}

interface SentryGuardWorkerFixtures {
  fakeSentryReceiver: FakeReceiver;
}

const localBenchmarkOrigins = new Set([
  "http://127.0.0.1:4373",
  "http://127.0.0.1:4374",
  "http://127.0.0.1:4375",
  "http://127.0.0.1:4376",
  "http://127.0.0.1:4377",
  "http://127.0.0.1:4378",
]);

async function startFakeReceiver(): Promise<FakeReceiver> {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? "/");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end("<!doctype html><title>Local telemetry guard probe</title>");
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  server.unref();
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    requests,
    server,
  };
}

async function closeServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

export const test = base.extend<SentryGuardFixtures, SentryGuardWorkerFixtures>({
  fakeSentryReceiver: [async ({}, use) => {
    const receiver = await startFakeReceiver();
    try { await use(receiver); }
    finally { await closeServer(receiver.server); }
  }, { scope: "worker" }],

  sentryNetworkGuard: [async ({ context, page, fakeSentryReceiver }, use, testInfo) => {
    const blockedUrls: string[] = [];
    const receiverRequestOffset = fakeSentryReceiver.requests.length;
    const guardPage = `${fakeSentryReceiver.origin}/guard.html`;
    await context.route("**/*", async (route) => {
      const requestUrl = route.request().url();
      const url = new URL(requestUrl);
      if (requestUrl === guardPage) {
        await route.continue();
        return;
      }
      const isNetworkRequest = url.protocol === "http:" || url.protocol === "https:";
      if (url.origin === fakeSentryReceiver.origin
        || (isNetworkRequest && !localBenchmarkOrigins.has(url.origin))) {
        blockedUrls.push(requestUrl);
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });

    await page.goto(guardPage);
    await page.evaluate(async (receiverOrigin) => {
      void fetch(`${receiverOrigin}/probe/fetch`).catch(() => undefined);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${receiverOrigin}/probe/xhr`);
      xhr.addEventListener("error", () => undefined, { once: true });
      xhr.send("envelope");
      navigator.sendBeacon(`${receiverOrigin}/probe/beacon`, "envelope");
      const frame = document.createElement("iframe");
      frame.src = `${receiverOrigin}/probe/iframe`;
      document.body.append(frame);
      const worker = new Worker(`${receiverOrigin}/probe/worker`);
      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.register(`${receiverOrigin}/probe/service-worker`).catch(() => undefined);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      worker.terminate();
      frame.remove();
    }, fakeSentryReceiver.origin);

    const blockedPaths = blockedUrls.map((value) => new URL(value).pathname);
    expect(blockedPaths).toEqual(expect.arrayContaining([
      "/probe/fetch",
      "/probe/xhr",
      "/probe/beacon",
      "/probe/iframe",
      "/probe/worker",
    ]));
    expect(context.serviceWorkers()).toHaveLength(0);
    expect(fakeSentryReceiver.requests.slice(receiverRequestOffset)).toEqual(["/guard.html"]);
    await testInfo.attach("sentry-network-guard", {
      body: Buffer.from(JSON.stringify({
        browser: testInfo.project.name,
        allowlistedOrigins: [...localBenchmarkOrigins],
        blockedProbePaths: blockedPaths.sort(),
        fakeReceiverDeliveredPaths: fakeSentryReceiver.requests.slice(receiverRequestOffset),
        activeServiceWorkers: context.serviceWorkers().length,
      })),
      contentType: "application/json",
    });
    await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return;
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    });
    await page.goto("about:blank");
    await use();
  }, { auto: true }],
});

export { expect };
