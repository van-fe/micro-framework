import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";

isolateBrowserProcess(import.meta.url);

test("forwards asynchronous Realm errors with instance attribution and stops on disposal", async ({ page }) => {
  await page.route("**/async-errors.js", (route) => route.fulfill({ contentType: "text/javascript", body: `
    export function mount() {
      setTimeout(() => { throw new Error('timer-probe'); }, 20);
      setTimeout(() => { Promise.reject(new Error('rejection-probe')); }, 30);
    }
    export function unmount() {}
  ` }));
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
  const result = await page.evaluate(async () => {
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
    const slot = document.body.appendChild(document.createElement("div"));
    const errors: Array<{ phase: string; instanceId?: string; name?: string }> = [];
    runtime.errors.subscribe(({ phase, instanceId, name }) => errors.push({ phase, instanceId, name }));
    const handle = await runtime.mountApp({ name: "async", container: slot, entry: { type: "module", url: new URL("/async-errors.js", location.href).href } });
    const frameWindow = slot.querySelector("iframe")!.contentWindow!;
    await new Promise((resolve) => setTimeout(resolve, 150));
    await handle.dispose();
    frameWindow.dispatchEvent(new ErrorEvent("error", { message: "after disposal" }));
    await runtime.destroy();
    return { errors, instanceId: handle.instanceId };
  });
  expect(result.errors).toEqual([
    { phase: "realm.error", instanceId: result.instanceId, name: "async" },
    { phase: "realm.unhandledrejection", instanceId: result.instanceId, name: "async" },
  ]);
});

test("forwards asynchronous cross-origin guest errors through its private channel", async ({ page }) => {
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
  await page.evaluate(async () => {
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
    const slot = document.body.appendChild(document.createElement("div"));
    const errors: string[] = [];
    runtime.errors.subscribe((event) => errors.push(event.phase));
    await runtime.mountApp({ name: "guest-errors", container: slot, entry: { type: "html", url: "http://127.0.0.1:5174/strong-isolation.html" }, isolation: { mode: "cross-origin" }, props: { title: "Guest", count: 0, createdAt: new Date(), labels: new Map() } });
    Reflect.set(window, "__guestErrors", { runtime, errors });
  });
  const frame = page.frames().find((candidate) => candidate.url().includes("strong-isolation.html"))!;
  await frame.evaluate(() => {
    setTimeout(() => { throw new Error("guest timer"); }, 0);
    setTimeout(() => { Promise.reject(new Error("guest rejection")); }, 20);
  });
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "__guestErrors").errors)).toEqual(["realm.error", "realm.unhandledrejection"]);
  await page.evaluate(() => Reflect.get(window, "__guestErrors").runtime.destroy());
});
