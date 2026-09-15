import { mkdir, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import {
  PlaywrightBrowserProvider,
  playwright,
  type PlaywrightProviderOptions,
} from "@vitest/browser-playwright";
import type { BrowserContext, Page } from "@playwright/test";

interface GuardEvidence {
  readonly browser: string;
  readonly blockedProbePaths: string[];
  readonly fakeReceiverDeliveredPaths: string[];
  readonly activeServiceWorkers: number;
}

const NON_LOOPBACK_HTTP = /^https?:\/\/(?!(?:127\.0\.0\.1|localhost|\[::1\])(?::|\/|$))/i;

class SentryGuardedPlaywrightProvider extends PlaywrightBrowserProvider {
  #receiver?: { origin: string; requests: string[]; server: Server };
  readonly #guardedContexts = new WeakSet<BrowserContext>();
  readonly #evidence: GuardEvidence[] = [];

  async #receiverForProbe(): Promise<{ origin: string; requests: string[]; server: Server }> {
    if (this.#receiver) return this.#receiver;
    const requests: string[] = [];
    const server = createServer((request, response) => {
      requests.push(request.url ?? "/");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end("<!doctype html><title>Local telemetry guard probe</title>");
    });
    await new Promise<void>((resolveListen, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolveListen);
    });
    server.unref();
    this.#receiver = {
      origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      requests,
      server,
    };
    return this.#receiver;
  }

  async #installGuard(page: Page): Promise<void> {
    const context = page.context();
    if (this.#guardedContexts.has(context)) return;
    this.#guardedContexts.add(context);
    const receiver = await this.#receiverForProbe();
    const receiverOffset = receiver.requests.length;
    const blockedUrls: string[] = [];
    const guardPage = `${receiver.origin}/guard.html`;
    await context.route(`${receiver.origin}/**`, async (route) => {
      const requestUrl = route.request().url();
      if (requestUrl === guardPage) {
        await route.continue();
        return;
      }
      blockedUrls.push(requestUrl);
      await route.abort("blockedbyclient");
    });
    await context.route(NON_LOOPBACK_HTTP, async (route) => {
      blockedUrls.push(route.request().url());
      await route.abort("blockedbyclient");
    });
    await page.goto(guardPage, { timeout: 0 });
    await page.evaluate(async (receiverOrigin: string) => {
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
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
      worker.terminate();
      frame.remove();
    }, receiver.origin);
    const blockedProbePaths = blockedUrls.map((value) => new URL(value).pathname).sort();
    for (const expected of ["/probe/fetch", "/probe/xhr", "/probe/beacon", "/probe/iframe", "/probe/worker"]) {
      if (!blockedProbePaths.includes(expected)) throw new Error(`Sentry guard did not block ${expected}.`);
    }
    const delivered = receiver.requests.slice(receiverOffset);
    if (delivered.length !== 1 || delivered[0] !== "/guard.html") {
      throw new Error(`Sentry guard fake receiver observed unexpected delivery: ${JSON.stringify(delivered)}.`);
    }
    if (context.serviceWorkers().length !== 0) throw new Error("Sentry guard observed an active Service Worker.");
    this.#evidence.push({
      browser: this.browserName,
      blockedProbePaths,
      fakeReceiverDeliveredPaths: delivered,
      activeServiceWorkers: 0,
    });
  }

  override async openPage(sessionId: string, url: string, options: { parallel: boolean }): Promise<void> {
    const openBrowserPage = Reflect.get(this, "openBrowserPage") as (
      session: string,
      openOptions: { parallel: boolean },
    ) => Promise<Page>;
    const page = await openBrowserPage.call(this, sessionId, options);
    await this.#installGuard(page);
    await page.goto(url, { timeout: 0 });
  }

  override async close(): Promise<void> {
    try { await super.close(); }
    finally {
      const evidenceDirectory = resolve(process.cwd(), "test-results", "sentry-network-guard");
      await mkdir(evidenceDirectory, { recursive: true });
      await writeFile(
        resolve(evidenceDirectory, `vitest-${this.browserName}.json`),
        `${JSON.stringify(this.#evidence, null, 2)}\n`,
        "utf8",
      );
      const receiver = this.#receiver;
      if (receiver) {
        receiver.server.closeAllConnections();
        await new Promise<void>((resolveClose, reject) => {
          receiver.server.close((error) => error ? reject(error) : resolveClose());
        });
      }
    }
  }
}

export function sentryGuardedPlaywright(options: PlaywrightProviderOptions = {}) {
  const guardedOptions = {
    ...options,
    contextOptions: {
      ...options.contextOptions,
      serviceWorkers: "block",
    },
  } as PlaywrightProviderOptions;
  const provider = playwright(guardedOptions);
  return {
    ...provider,
    providerFactory(project: Parameters<typeof provider.providerFactory>[0]) {
      return new SentryGuardedPlaywrightProvider(project, guardedOptions);
    },
  };
}
