import { isolateBrowserProcess } from "./browser-process-fixture";
import { addSlot, expect, test } from "./upstream-batch02-runtime-fixture";
import type { Page } from "@playwright/test";

isolateBrowserProcess(import.meta.url);

async function mountDeployment(page: Page, url: string): Promise<string | null> {
  return page.evaluate(async (url) => {
    const state = window.__upstreamRuntime__!;
    try {
      const handle = await state.runtime.mountApp({
        name: "deployed", entry: { type: "html", url }, container: state.slots[0]!, keepAlive: true,
      });
      state.handles.push(handle);
      return null;
    } catch (error) { return String(error); }
  }, url);
}

async function expectFailureCleaned(page: Page): Promise<void> {
  await expect(page.locator("#deployment-slot micro-app-host, #deployment-slot iframe")).toHaveCount(0);
  const errors = await page.evaluate(() => window.__upstreamRuntime__!.errors);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors.every(error => error.name === "deployed" && error.phase === "mount")).toBe(true);
  await page.evaluate(() => { window.__upstreamRuntime__!.expectedErrors = [...window.__upstreamRuntime__!.errors]; });
}

async function clickDeployment(page: Page, version: number): Promise<void> {
  const button = page.locator("#deployment-slot").getByRole("button");
  await expect(button).toHaveText(`Deployment v${version}: 0`);
  await button.click();
  await expect(button).toHaveText(`Deployment v${version}: 1`);
  expect(await page.evaluate(() => window.__upstreamRuntime__!.handles.at(-1)!.getStatus())).toBe("mounted");
}

for (const cause of ["offline", "server-stopped"] as const) {
  test(`${cause === "offline" ? "Q1990" : "Q1885"} retries the identical HTML entry after ${cause} recovery and sends a fresh HTTP request`, async ({ page, context, deployment }) => {
    await addSlot(page, "deployment-slot");
    if (cause === "offline") await context.setOffline(true);
    else await deployment.stop();
    try {
      expect(await mountDeployment(page, deployment.url)).toContain("All application entries failed");
      await expectFailureCleaned(page);
      expect(deployment.requests).toEqual([]);
    } finally {
      if (cause === "offline") await context.setOffline(false);
      else await deployment.start();
    }
    expect(await mountDeployment(page, deployment.url)).toBeNull();
    await clickDeployment(page, 1);
    expect(deployment.requests).toContain("/index.html");
    expect(deployment.requests).toContain("/entry.v1.js");
  });
}

test("Q2166 disposes a cached application and loads a new deployment and failed-chunk recovery at the identical entry URL", async ({ page, deployment }) => {
  await addSlot(page, "deployment-slot");
  expect(await mountDeployment(page, deployment.url)).toBeNull();
  await clickDeployment(page, 1);
  const firstId = await page.evaluate(async () => {
    const handle = window.__upstreamRuntime__!.handles.at(-1)!;
    await handle.dispose();
    return handle.instanceId;
  });
  await expect(page.locator("#deployment-slot micro-app-host, #deployment-slot iframe")).toHaveCount(0);
  deployment.version = 2;
  expect(await mountDeployment(page, deployment.url)).toBeNull();
  await clickDeployment(page, 2);
  expect(await page.evaluate(() => window.__upstreamRuntime__!.handles.at(-1)!.instanceId)).not.toBe(firstId);
  await page.evaluate(() => window.__upstreamRuntime__!.handles.at(-1)!.dispose());
  deployment.version = 3;
  deployment.missing = true;
  expect(await mountDeployment(page, deployment.url)).toContain("All application entries failed");
  await expectFailureCleaned(page);
  deployment.missing = false;
  expect(await mountDeployment(page, deployment.url)).toBeNull();
  await clickDeployment(page, 3);
  expect(deployment.requests.filter(path => path === "/index.html")).toHaveLength(4);
  expect(deployment.requests.filter(path => path === "/entry.v3.js").length).toBeGreaterThanOrEqual(2);
});

test("W1028 reports a removed deployment chunk to the runtime error subscriber and permits explicit new-entry recovery", async ({ page, deployment }) => {
  await addSlot(page, "deployment-slot");
  expect(await mountDeployment(page, deployment.url)).toBeNull();
  await clickDeployment(page, 1);
  await page.evaluate(() => window.__upstreamRuntime__!.handles.at(-1)!.dispose());
  // The server still supplies the old HTML while the old hashed asset has been deleted.
  deployment.missing = true;
  expect(await mountDeployment(page, deployment.url)).toContain("All application entries failed");
  await expectFailureCleaned(page);
  expect(deployment.requests.filter(path => path === "/entry.v1.js").length).toBeGreaterThanOrEqual(2);
  const failed = await page.evaluate(() => window.__upstreamRuntime__!.errors);
  expect(failed).toEqual([{ name: "deployed", phase: "mount", message: expect.stringContaining("entry.v1.js") }]);
  deployment.version = 2;
  deployment.missing = false;
  expect(await mountDeployment(page, deployment.url.replace("index.html", "release2.html"))).toBeNull();
  await clickDeployment(page, 2);
  expect(deployment.requests).toContain("/release2.html");
  expect(deployment.requests).toContain("/entry.v2.js");
});
