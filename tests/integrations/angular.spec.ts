import { expect, test } from "../e2e/browser-process-fixture";

for (const [toolchain, port] of [["Vite", 6390], ["Webpack", 6391]] as const) {
  test(`${toolchain} AOT Angular mounts, updates, interacts and releases its isolated Realm`, async ({ page }) => {
    await page.goto("/benchmark.html");
    await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
    await page.evaluate(async (port) => {
      const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false }, ...(port === 6391 ? { bootstrapUrl: `http://127.0.0.1:${port}/realm-bootstrap.js` } : {}) });
      const slot = document.body.appendChild(document.createElement("div"));
      const base = `http://127.0.0.1:${port}/`;
      const manifestUrl = `${base}micro-frame-manifest.json`;
      const manifest = await (await fetch(manifestUrl)).json();
      const handle = await runtime.mountApp({ name: "angular", container: slot, entry: { type: "module", url: new URL(manifest.entry, base).href, manifest: { url: manifestUrl } }, props: { title: "Orders" } });
      Object.assign(window, { __angularContract: { runtime, handle, slot } });
    }, port);
    await expect(page.getByRole("heading", { name: "Orders · ready" })).toBeVisible();
    await page.getByRole("button", { name: "Count: 0" }).click();
    await expect(page.getByRole("button", { name: "Count: 1" })).toBeVisible();
    const result = await page.evaluate(async () => {
      const { runtime, handle, slot } = (window as unknown as { __angularContract: { runtime: import("@micro-framework/runtime").MicroRuntime; handle: import("@micro-framework/contracts").AppHandle<{ title: string }>; slot: HTMLElement } }).__angularContract;
      const host = slot.querySelector("micro-app-host")!;
      const frame = host.querySelector("iframe")!;
      const frameWindow = frame.contentWindow as Window & typeof globalThis;
      const button = host.shadowRoot!.querySelector("button")!;
      const realm = button instanceof frameWindow.HTMLElement
        && Reflect.get(frameWindow, "__angularRealmProbe") === true
        && Reflect.get(window, "__angularRealmProbe") === undefined;
      await handle.update({ title: "Updated" });
      const text = host.shadowRoot!.textContent;
      await runtime.destroy();
      return { realm, text, hosts: slot.childElementCount, frameConnected: frame.isConnected };
    });
    expect(result.realm).toBe(true);
    expect(result.text).toContain("Updated");
    expect(result.text).toContain("Count: 1");
    expect(result.hosts).toBe(0);
    expect(result.frameConnected).toBe(false);
  });
}
