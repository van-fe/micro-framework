import { isolateBrowserProcess } from "./browser-process-fixture";
import { addSlot, counterEntry, expect, expectStatus, installRouteLinks, routeTo, test } from "./upstream-runtime-fixture";

isolateBrowserProcess(import.meta.url);

for (const keepAlive of [false, true]) {
  test(`Q2735 completes native hash A-B-A navigation with live DOM and isolated Realms (keepAlive=${keepAlive})`, async ({ page }) => {
    await addSlot(page, "route-slot");
    await installRouteLinks(page);
    await page.evaluate(async (keepAlive) => {
      const state = window.__upstreamRuntime__!;
      state.runtime.registerApps(["a", "b"].map((name) => ({
        name: `route-${name}`, activeWhen: `/${name}`, container: state.slots[0]!, keepAlive,
        entry: { type: "module" as const, url: new URL("/upstream-runtime-counter.js", location.href).href },
        props: { title: name.toUpperCase() },
      })));
      await state.runtime.start();
    }, keepAlive);
    await routeTo(page, "a");
    await expectStatus(page, "route-a", "mounted");
    const a = page.locator('#route-slot micro-app-host[data-micro-app="route-a"]');
    const b = page.locator('#route-slot micro-app-host[data-micro-app="route-b"]');
    await expect(a).toHaveCount(1);
    await a.getByRole("button").click();
    await expect(a.getByRole("button")).toHaveText("A: 1");
    await page.evaluate(() => {
      const state = window.__upstreamRuntime__!;
      state.originalHost = state.slots[0]!.querySelector("micro-app-host")!;
      state.originalFrame = state.slots[0]!.querySelector("iframe")!;
    });
    await routeTo(page, "b");
    await expectStatus(page, "route-a", "unmounted");
    await expectStatus(page, "route-b", "mounted");
    if (keepAlive) { await expect(a).toBeHidden(); await expect(a).toHaveAttribute("inert"); }
    else await expect(a).toHaveCount(0);
    await b.getByRole("button").click();
    await expect(b.getByRole("button")).toHaveText("B: 1");
    // A real browser history traversal produces hashchange/popstate; the test dispatches neither.
    await page.goBack();
    await expect(page).toHaveURL(/#\/a$/);
    await expectStatus(page, "route-b", "unmounted");
    await expectStatus(page, "route-a", "mounted");
    if (keepAlive) await expect(b).toBeHidden();
    else await expect(b).toHaveCount(0);
    await expect(a.getByRole("button")).toHaveText(`A: ${keepAlive ? 1 : 0}`);
    await a.getByRole("button").click();
    await expect(a.getByRole("button")).toHaveText(`A: ${keepAlive ? 2 : 1}`);
    expect(await page.evaluate(() => {
      const state = window.__upstreamRuntime__!;
      const host = state.slots[0]!.querySelector('micro-app-host[data-micro-app="route-a"]')!;
      const frame = host.querySelector("iframe")!;
      const button = host.shadowRoot!.querySelector("button")!;
      return {
        sameHost: host === state.originalHost,
        sameFrame: frame === state.originalFrame,
        ownRealmFindsButton: frame.contentDocument!.querySelector("button") === button,
        hostDocumentFindsButton: document.querySelector("button[data-instance-id]") !== null,
        distinctFrames: new Set([...state.slots[0]!.querySelectorAll("iframe")].map((item) => item.contentWindow)).size,
        mountedA: state.lifecycle.filter((event) => event.name === "route-a" && event.status === "mounted").length,
      };
    })).toEqual({ sameHost: keepAlive, sameFrame: keepAlive, ownRealmFindsButton: true,
      hostDocumentFindsButton: false, distinctFrames: keepAlive ? 2 : 1, mountedA: 2 });
    await expect(page.locator("#route-slot micro-app-host:not([hidden])")).toHaveCount(1);
  });
}

test("Q2854 requests a new entry after a 404 with the same name and container", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/upstream-runtime-missing.html", (route) => {
    requests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 404, contentType: "text/html", body: "entry missing" });
  });
  await page.route("**/upstream-runtime-backup.html", (route) => {
    requests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ contentType: "text/html", body: '<div></div><script type="module" src="/upstream-runtime-counter.js"></script>' });
  });
  await addSlot(page, "retry-slot");
  await installRouteLinks(page);
  await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    state.runtime.registerApps([{
      name: "same-entry-name", container: state.slots[0]!, activeWhen: "/a",
      entry: { type: "html", url: new URL("/upstream-runtime-missing.html", location.href).href },
      props: { title: "Recovered" },
    }]);
    await state.runtime.start();
  });
  await routeTo(page, "a");
  await expectStatus(page, "same-entry-name", "error");
  await expect(page.locator("#retry-slot micro-app-host, #retry-slot iframe")).toHaveCount(0);
  expect(await page.evaluate(() => window.__upstreamRuntime__!.errors)).toEqual([
    { name: "same-entry-name", phase: "mount", message: expect.stringContaining("404") },
  ]);
  const result = await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    state.expectedErrors = [...state.errors];
    const failedHandle = state.runtime.getAppHandle("same-entry-name")!;
    await state.runtime.unregister("same-entry-name");
    state.runtime.registerApps([{
      name: "same-entry-name", container: state.slots[0]!, activeWhen: "/a",
      entry: { type: "html", url: new URL("/upstream-runtime-backup.html", location.href).href },
      props: { title: "Recovered" },
    }]);
    return { previousStatus: failedHandle.getStatus(), previousId: failedHandle.instanceId };
  });
  expect(result.previousStatus).toBe("disposed");
  await expectStatus(page, "same-entry-name", "mounted");
  expect(await page.evaluate(() => window.__upstreamRuntime__!.runtime.getAppHandle("same-entry-name")!.instanceId)).not.toBe(result.previousId);
  const button = page.locator("#retry-slot").getByRole("button");
  await expect(button).toHaveText("Recovered: 0");
  await button.click();
  await expect(button).toHaveText("Recovered: 1");
  expect(requests).toEqual(["/upstream-runtime-missing.html", "/upstream-runtime-backup.html"]);
  await expect(page.locator("#retry-slot micro-app-host")).toHaveCount(1);
  await expect(page.locator("#retry-slot iframe")).toHaveCount(1);
});

for (const phase of ["entry", "bootstrap"] as const) {
  test(`Q886 isolates an application ${phase} ReferenceError and navigates to a working application`, async ({ page }) => {
    await page.route("**/upstream-runtime-broken.js", (route) => route.fulfill({
      contentType: "text/javascript", body: (phase === "entry"
        ? 'throw new ReferenceError("upstream entry failure");\n'
        : 'export function bootstrap() { throw new ReferenceError("upstream bootstrap failure"); }\n') + counterEntry,
    }));
    await addSlot(page, "failure-route-slot");
    await installRouteLinks(page);
    await page.evaluate(async () => {
      const state = window.__upstreamRuntime__!;
      state.runtime.registerApps([
        { name: "broken-route", activeWhen: "/a", container: state.slots[0]!,
          entry: { type: "module", url: new URL("/upstream-runtime-broken.js", location.href).href }, props: { title: "Broken" } },
        { name: "healthy-route", activeWhen: "/b", container: state.slots[0]!,
          entry: { type: "module", url: new URL("/upstream-runtime-counter.js", location.href).href }, props: { title: "Healthy" } },
      ]);
      await state.runtime.start();
    });
    await routeTo(page, "a");
    await expectStatus(page, "broken-route", "error");
    await expect(page.locator("#failure-route-slot micro-app-host, #failure-route-slot iframe")).toHaveCount(0);
    expect(await page.evaluate(() => window.__upstreamRuntime__!.errors)).toEqual([
      { name: "broken-route", phase: "mount", message: expect.stringContaining(`upstream ${phase} failure`) },
    ]);
    await page.evaluate(() => { window.__upstreamRuntime__!.expectedErrors = [...window.__upstreamRuntime__!.errors]; });
    await routeTo(page, "b");
    await expectStatus(page, "healthy-route", "mounted");
    const button = page.locator("#failure-route-slot").getByRole("button");
    await expect(button).toHaveText("Healthy: 0");
    await button.click();
    await expect(button).toHaveText("Healthy: 1");
    await expect(page.locator("#failure-route-slot micro-app-host")).toHaveCount(1);
    await expect(page.locator("#failure-route-slot iframe")).toHaveCount(1);
  });
}

test("Q578 loads a host route stylesheet after native navigation away from a child application", async ({ page }) => {
  await page.route("**/upstream-runtime-host-route.css", (route) => route.fulfill({
    contentType: "text/css", body: "#host-lazy-route { color: rgb(137, 23, 81); padding-left: 19px; }",
  }));
  await addSlot(page, "child-route-slot");
  await addSlot(page, "host-route-slot");
  await installRouteLinks(page);
  await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    state.runtime.registerApps([{
      name: "child-route", activeWhen: "/a", container: state.slots[0]!,
      entry: { type: "module", url: new URL("/upstream-runtime-counter.js", location.href).href }, props: { title: "Child" },
    }]);
    const onRoute = () => {
      if (location.hash !== "#/host") return;
      window.removeEventListener("hashchange", onRoute);
      const probe = document.createElement("p");
      probe.id = "host-lazy-route";
      probe.textContent = "Host lazy route";
      state.slots[1]!.appendChild(probe);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/upstream-runtime-host-route.css";
      link.dataset.upstreamRuntime = "";
      document.head.appendChild(link);
    };
    window.addEventListener("hashchange", onRoute);
    await state.runtime.start();
  });
  await routeTo(page, "a");
  await expectStatus(page, "child-route", "mounted");
  await page.locator("#child-route-slot").getByRole("button").click();
  await routeTo(page, "host");
  await expectStatus(page, "child-route", "unmounted");
  const probe = page.locator("#host-lazy-route");
  await expect(probe).toBeVisible();
  await expect(probe).toHaveCSS("color", "rgb(137, 23, 81)");
  await expect(probe).toHaveCSS("padding-left", "19px");
  expect(await page.evaluate(() => document.querySelector('link[href="/upstream-runtime-host-route.css"]')!.parentNode === document.head)).toBe(true);
  await expect(page.locator("#child-route-slot micro-app-host, #child-route-slot iframe")).toHaveCount(0);
});
