import type { Page } from "@playwright/test";
import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";

isolateBrowserProcess(import.meta.url);

interface DisposableHandle {
  dispose(): Promise<void>;
}

interface DisposableRuntime {
  destroy(): Promise<void>;
}

declare global {
  interface Window {
    __crossTabResources__?: Array<{
      handle: DisposableHandle;
      runtime: DisposableRuntime;
    }>;
  }
}

const entry = "http://127.0.0.1:5174/src/cross-tab-lifecycle.ts";

async function mountProbe(page: Page, name: string, slotId: string): Promise<void> {
  await page.evaluate(async ({ entryUrl, name, slotId }) => {
    const slot = document.createElement("div");
    slot.id = slotId;
    document.body.append(slot);
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
    const handle = await runtime.mountApp({
      name,
      entry: { url: entryUrl, type: "module" },
      container: slot,
    });
    (window.__crossTabResources__ ??= []).push({ handle, runtime });
  }, { entryUrl: entry, name, slotId });
}

async function postFrom(page: Page, slotId: string, source: string, sequence: number): Promise<void> {
  await page.evaluate(({ slotId, source, sequence }) => {
    const frame = document.querySelector<HTMLIFrameElement>(`#${slotId} iframe`);
    const probe = (frame?.contentWindow as Window & {
      __crossTabProbe__?: { post(payload: { source: string; sequence: number }): void };
    } | null)?.__crossTabProbe__;
    if (!probe) throw new Error(`Cross-tab probe is missing from ${slotId}.`);
    probe.post({ source, sequence });
  }, { slotId, source, sequence });
}

async function receivedBy(page: Page, slotId: string): Promise<Array<{ source: string; sequence: number }>> {
  return page.evaluate((slotId) => {
    const frame = document.querySelector<HTMLIFrameElement>(`#${slotId} iframe`);
    return (frame?.contentWindow as Window & {
      __crossTabProbe__?: { received: Array<{ source: string; sequence: number }> };
    } | null)?.__crossTabProbe__?.received ?? [];
  }, slotId);
}

async function disposeProbes(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (const resource of [...(window.__crossTabResources__ ?? [])].reverse()) {
      await resource.handle.dispose();
      await resource.runtime.destroy();
    }
    window.__crossTabResources__ = [];
  });
}

test("namespaces BroadcastChannel by application while allowing same-app cross-tab traffic", async ({ page, context }) => {
  const secondTab = await context.newPage();
  await Promise.all([page.goto("/benchmark.html"), secondTab.goto("/benchmark.html")]);
  await Promise.all([
    page.waitForFunction(() => typeof window.__createMicroFrameBenchmarkRuntime__ === "function"),
    secondTab.waitForFunction(() => typeof window.__createMicroFrameBenchmarkRuntime__ === "function"),
  ]);

  await Promise.all([
    mountProbe(page, "cross-tab-orders", "orders-first-tab"),
    mountProbe(secondTab, "cross-tab-orders", "orders-second-tab"),
  ]);
  await mountProbe(secondTab, "cross-tab-billing", "billing-second-tab");

  await postFrom(page, "orders-first-tab", "first-tab", 1);
  await expect.poll(() => receivedBy(secondTab, "orders-second-tab")).toEqual([
    { source: "first-tab", sequence: 1 },
  ]);
  await secondTab.waitForTimeout(100);
  expect(await receivedBy(secondTab, "billing-second-tab")).toEqual([]);

  await postFrom(secondTab, "orders-second-tab", "second-tab", 2);
  await expect.poll(() => receivedBy(page, "orders-first-tab")).toEqual([
    { source: "second-tab", sequence: 2 },
  ]);

  await Promise.all([disposeProbes(page), disposeProbes(secondTab)]);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(secondTab.locator("iframe")).toHaveCount(0);
  await secondTab.close();
});
