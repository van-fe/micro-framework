import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";

isolateBrowserProcess(import.meta.url);

for (const scenario of ["hook", "html", "manifest", "script", "resource"]) {
  test(`bounds pending ${scenario} work and completes cleanup`, async ({ page }) => {
    await page.route("**/pending-*", () => {});
    await page.route("**/cancellation.html", (route) => route.fulfill({ contentType: "text/html", body: '<script src="/pending-script.js"></script>' }));
    await page.route("**/cancellation.js", (route) => route.fulfill({ contentType: "text/javascript", body: `
      export function mount(props) {
        if (props.resource) {
          props.$runtime.resources.add(() => props.container.ownerDocument.body.dataset.cleaned = 'yes');
          props.$runtime.resources.add(() => new Promise(() => {}));
        }
      }
      export function unmount() {}
    ` }));
    await page.goto("/benchmark.html");
    await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
    const result = await page.evaluate(async (scenario) => {
      const slot = document.body.appendChild(document.createElement("div"));
      const errors: string[] = [];
      const runtime = window.__createMicroFrameBenchmarkRuntime__!({
        storage: { persistent: false }, timeouts: { load: 300, lifecycle: 100 },
        hooks: scenario === "hook" ? { beforeMount: () => new Promise(() => {}) } : {},
      });
      runtime.errors.subscribe((event) => errors.push(event.phase));
      const url = new URL(scenario === "html" ? "/pending-entry.html" : scenario === "script" ? "/cancellation.html" : "/cancellation.js", location.href).href;
      const mounting = runtime.mountApp({ name: "cancel", container: slot, entry: {
        url, type: scenario === "html" || scenario === "script" ? "html" : "module",
        ...(scenario === "manifest" ? { manifest: { url: new URL("/pending-manifest.json", location.href).href } } : {}),
      }, props: { resource: scenario === "resource" } }).catch(() => undefined);
      await mounting;
      await runtime.destroy().catch(() => undefined);
      return { hosts: slot.childElementCount, errors, cleaned: document.body.dataset.cleaned };
    }, scenario);
    expect(result.hosts).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    if (scenario === "resource") expect(result.cleaned).toBe("yes");
  });
}

test("destroy aborts HTML fetch even with load timeout disabled", async ({ page }) => {
  await page.route("**/pending.html", () => {});
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
  const result = await page.evaluate(async () => {
    const slot = document.body.appendChild(document.createElement("div"));
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false }, timeouts: { load: 0 } });
    const mounting = runtime.mountApp({ name: "pending", container: slot, entry: new URL("/pending.html", location.href).href });
    await new Promise((resolve) => setTimeout(resolve, 50));
    await runtime.destroy();
    await mounting;
    return slot.childElementCount;
  });
  expect(result).toBe(0);
});
