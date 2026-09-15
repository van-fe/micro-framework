import type { AppHandle } from "@micro-framework/contracts";
import type { MicroRuntime } from "@micro-framework/runtime";
import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";
import { counterEntry } from "./upstream-runtime-fixture";

isolateBrowserProcess(import.meta.url);

declare global {
  interface Window {
    __upstreamEviction__?: { runtime: MicroRuntime; handle: AppHandle; errors: string[]; finished: boolean };
  }
}

for (const remount of [false, true]) {
  test(`Q1089 completes keepAlive eviction without waiting on its own unmount (maxInstances=0, remount=${remount})`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("**/upstream-runtime-eviction.js", (route) => route.fulfill({ contentType: "text/javascript", body: counterEntry }));
    await page.goto("/benchmark.html");
    await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
    await page.evaluate(async () => {
      const runtime = window.__createMicroFrameBenchmarkRuntime__!({
        storage: { persistent: false }, keepAlive: { maxInstances: 0 },
      });
      const errors: string[] = [];
      runtime.errors.subscribe(({ error }) => errors.push(String(error)));
      const slot = document.body.appendChild(document.createElement("div"));
      slot.id = "eviction-slot";
      const handle = await runtime.mountApp({
        name: "zero-cache", container: slot, keepAlive: true,
        entry: { type: "module", url: new URL("/upstream-runtime-eviction.js", location.href).href },
        props: { title: "Zero cache" },
      });
      window.__upstreamEviction__ = { runtime, handle, errors, finished: false };
    });
    let finished = false;
    try {
      const button = page.locator("#eviction-slot").getByRole("button");
      await button.click();
      await expect(button).toHaveText("Zero cache: 1");
      const result = await page.evaluate(async (remount) => {
        const state = window.__upstreamEviction__!;
        const operations = [state.handle.unmount()];
        if (remount) operations.push(state.handle.mount());
        const outcome = await Promise.race([
          Promise.all(operations).then(() => true),
          new Promise<false>((resolve) => setTimeout(() => resolve(false), 1_500)),
        ]);
        state.finished = outcome;
        return { finished: outcome, status: state.handle.getStatus() };
      }, remount);
      finished = result.finished;
      expect(result).toEqual({ finished: true, status: remount ? "mounted" : "disposed" });
      if (remount) {
        await expect(button).toHaveText("Zero cache: 1");
        await button.click();
        await expect(button).toHaveText("Zero cache: 2");
        await expect(page.locator("#eviction-slot micro-app-host")).toHaveCount(1);
      } else {
        await expect(page.locator("#eviction-slot micro-app-host, #eviction-slot iframe")).toHaveCount(0);
      }
    } finally {
      if (finished) {
        const result = await page.evaluate(async () => {
          const state = window.__upstreamEviction__!;
          await state.runtime.destroy();
          const remaining = document.querySelectorAll("#eviction-slot micro-app-host, #eviction-slot iframe").length;
          document.querySelector("#eviction-slot")!.remove();
          delete window.__upstreamEviction__;
          return { remaining, errors: state.errors };
        });
        expect(result).toEqual({ remaining: 0, errors: [] });
      } else {
        // A failing deadlock probe cannot await the same deadlocked destructor;
        // closing its isolated page releases the browser Realm and its resources.
        await page.close();
      }
      expect(pageErrors).toEqual([]);
    }
  });
}

test("Q1089 rejects a reentrant mount during keepAlive disposal and completes lifecycle cleanup once", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/upstream-runtime-dispose-reentrant.js", (route) => route.fulfill({
    contentType: "text/javascript", body: `
      export function mount(props) { props.container.textContent = 'Disposable application'; }
      export function unmount(props) {
        props.container.dataset.unmountCalls = String(Number(props.container.dataset.unmountCalls || '0') + 1);
        props.container.replaceChildren();
      }
      export function dispose(props) {
        props.container.dataset.disposeCalls = String(Number(props.container.dataset.disposeCalls || '0') + 1);
      }
    `,
  }));
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
  const result = await page.evaluate(async () => {
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
    const errors: string[] = [];
    runtime.errors.subscribe(({ error }) => errors.push(String(error)));
    const slot = document.body.appendChild(document.createElement("div"));
    const handle = await runtime.mountApp({
      name: "reentrant-disposal", container: slot, keepAlive: true,
      entry: { type: "module", url: new URL("/upstream-runtime-dispose-reentrant.js", location.href).href },
    });
    const host = slot.querySelector("micro-app-host")!;
    const body = host.shadowRoot!.querySelector<HTMLElement>("[data-micro-app-root]")!;
    const requests: Promise<string>[] = [];
    const unsubscribe = runtime.lifecycle.subscribe((event) => {
      if (event.name === "reentrant-disposal" && event.status === "unmounting") {
        unsubscribe();
        requests.push(handle.mount().then(() => "resolved", () => "rejected"));
      }
    });
    try {
      await handle.dispose();
      return {
        status: handle.getStatus(), requests: await Promise.all(requests),
        unmountCalls: Number(body.dataset.unmountCalls || "0"),
        disposeCalls: Number(body.dataset.disposeCalls || "0"),
        remaining: slot.childElementCount, errors,
      };
    } finally {
      unsubscribe();
      await runtime.destroy();
      slot.remove();
    }
  });
  expect(result).toEqual({ status: "disposed", requests: ["rejected"], unmountCalls: 1, disposeCalls: 1, remaining: 0, errors: [] });
  expect(pageErrors).toEqual([]);
});
