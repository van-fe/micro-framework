import { appendFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test as base, type Browser } from "@playwright/test";

interface SentryGuardFixtures {
  sentryNetworkGuard: void;
}

interface WorkerFixtures {
  browserProcessFile: string;
  guardProbeBrowser: Browser;
}

const guardProxy = "http://127.0.0.1:4399";
const fakeReceiverOrigin = "http://sentry-guard.invalid";

export const test = base.extend<SentryGuardFixtures, WorkerFixtures>({
  browserProcessFile: ["shared", { scope: "worker", option: true }],
  guardProbeBrowser: [async ({ browser }, use) => {
    const probeBrowser = await browser.browserType().launch();
    try { await use(probeBrowser); }
    finally { await probeBrowser.close(); }
  }, { scope: "worker" }],
  browser: [async ({ browser, browserProcessFile }, use) => {
    // The worker option changes Playwright's worker identity at a file boundary.
    // Keep its native browser and per-test context setup/teardown unchanged.
    void browserProcessFile;
    await use(browser);
  }, { scope: "worker" }],
  sentryNetworkGuard: [async ({ context, guardProbeBrowser }, use, testInfo) => {
    const session = crypto.randomUUID();
    const suffix = `?session=${encodeURIComponent(session)}`;
    const guardPage = `${fakeReceiverOrigin}/guard.html${suffix}`;
    const probeContext = await guardProbeBrowser.newContext({
      proxy: { server: guardProxy },
      serviceWorkers: "block",
    });
    try {
      const probe = await probeContext.newPage();
      await probe.goto(guardPage);
      await probe.evaluate(async ({ receiverOrigin, suffix }) => {
        void fetch(`${receiverOrigin}/probe/fetch${suffix}`).catch(() => undefined);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${receiverOrigin}/probe/xhr${suffix}`);
        xhr.addEventListener("error", () => undefined, { once: true });
        xhr.send("envelope");
        navigator.sendBeacon(`${receiverOrigin}/probe/beacon${suffix}`, "envelope");
        const frame = document.createElement("iframe");
        frame.src = `${receiverOrigin}/probe/iframe${suffix}`;
        document.body.append(frame);
        const worker = new Worker(`${receiverOrigin}/probe/worker${suffix}`);
        if ("serviceWorker" in navigator) {
          await navigator.serviceWorker.register(`${receiverOrigin}/probe/service-worker${suffix}`).catch(() => undefined);
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
        worker.terminate();
        frame.remove();
      }, { receiverOrigin: fakeReceiverOrigin, suffix });
      expect(probeContext.serviceWorkers()).toHaveLength(0);
    } finally {
      await probeContext.close();
    }

    const statsUrl = `${guardProxy}/__guard__/stats?session=${encodeURIComponent(session)}`;
    const stats = await fetch(statsUrl).then((response) => response.json()) as {
      blocked: string[];
      delivered: string[];
    };
    const blockedPaths = stats.blocked;
    expect(blockedPaths).toEqual(expect.arrayContaining([
      "/probe/fetch", "/probe/xhr", "/probe/beacon", "/probe/iframe", "/probe/worker",
    ]));
    expect(context.serviceWorkers()).toHaveLength(0);
    expect(stats.delivered).toEqual(["/guard.html"]);
    const evidence = {
      browser: testInfo.project.name,
      blockedProbePaths: blockedPaths.sort(),
      fakeReceiverDeliveredPaths: stats.delivered,
      activeServiceWorkers: context.serviceWorkers().length,
    };
    await testInfo.attach("sentry-network-guard", {
      body: Buffer.from(JSON.stringify(evidence)),
      contentType: "application/json",
    });
    const evidenceDirectory = resolve(process.cwd(), "test-results", "sentry-network-guard");
    await mkdir(evidenceDirectory, { recursive: true });
    await appendFile(
      resolve(evidenceDirectory, `playwright-${testInfo.project.name}-${process.pid}.jsonl`),
      `${JSON.stringify(evidence)}\n`,
      "utf8",
    );
    await use();
    const finalStats = await fetch(statsUrl).then((response) => response.json()) as { delivered: string[] };
    expect(finalStats.delivered).toEqual(["/guard.html"]);
    expect(context.serviceWorkers()).toHaveLength(0);
  }, { auto: true }],
});

export function isolateBrowserProcess(fileUrl: string): void {
  // macOS + bundled WebKit stalls on the 75th fresh context even on a static
  // server without framework code. Use the same file lifetime for all engines
  // on macOS; a test or a file still exercises its real repeated Realm cleanup.
  // Evidence and an independent control: scripts/diagnose-webkit-context-navigation.mjs.
  if (process.platform === "darwin") test.use({ browserProcessFile: fileUrl });
}

export { expect };
