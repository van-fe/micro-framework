import { isolateBrowserProcess } from "./browser-process-fixture";
import { addSlot, expect, expectStatus, test } from "./upstream-runtime-fixture";

isolateBrowserProcess(import.meta.url);

test("Q1245 cold Vue Router hash-home to history-home to hash-about loads the first lazy route in its own Realm", async ({ page }) => {
  const lazyRequests: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.endsWith("/router-about.ts")) lazyRequests.push(request.url()); });
  await addSlot(page, "cold-router-slot");
  await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    const link = document.body.appendChild(document.createElement("a"));
    link.textContent = "Go history home"; link.href = "#/history/home";
    state.slots.push(link);
    state.runtime.services.set("navigateAcrossApps", (route: unknown) => { window.location.hash = String(route); });
    const entry = { type: "module" as const, url: "http://127.0.0.1:5179/src/upstream-batch02/router-entry.ts" };
    state.runtime.registerApps(["hash", "history"].map(routerMode => ({
      name: `cold-${routerMode}`, container: state.slots[0]!, activeWhen: `/${routerMode}`, entry,
      props: () => ({ routerMode, route: window.location.hash.endsWith("/about") ? "/about" : "/home" }),
    })));
    window.location.hash = "/hash/home";
    await state.runtime.start();
  });
  await expectStatus(page, "cold-hash", "mounted");
  await expect(page.getByText("Router home", { exact: true })).toBeVisible();
  expect(lazyRequests).toEqual([]);
  await page.getByRole("link", { name: "Go history home", exact: true }).click();
  await expectStatus(page, "cold-history", "mounted");
  await expect(page.locator('[data-router-mode="history"]')).toBeVisible();
  const historyRealm = await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>('#cold-router-slot micro-app-host[data-micro-app="cold-history"] iframe')!;
    return { location: frame.contentWindow!.location.href, documentURL: frame.contentDocument!.URL,
      entryRealmSurvived: Reflect.get(frame.contentWindow!, "__batch02RouterRealm__") === true };
  });
  console.log("Q1245 history Realm", JSON.stringify(historyRealm));
  expect(historyRealm.entryRealmSurvived).toBe(true);
  expect(lazyRequests).toEqual([]);
  await page.getByRole("button", { name: "Open cold hash about", exact: true }).click();
  await expect(page).toHaveURL(/#\/hash\/about$/);
  await expectStatus(page, "cold-hash", "mounted");
  const about = page.getByRole("button", { name: "Lazy about clicks: 0", exact: true });
  await expect(about).toBeVisible();
  await about.click();
  await expect(page.getByRole("button", { name: "Lazy about clicks: 1", exact: true })).toBeVisible();
  expect(lazyRequests).toHaveLength(1);
  expect(lazyRequests[0]).toMatch(/^http:\/\/127\.0\.0\.1:5179\/src\/upstream-batch02\/router-about\.ts/);
  expect(await page.evaluate(() => {
    const host = document.querySelector("#cold-router-slot micro-app-host")!;
    const frame = host.querySelector("iframe")!;
    return { iframeFindsAbout: frame.contentDocument!.querySelector("button")?.textContent === "Lazy about clicks: 1",
      hostCannotFindAbout: document.querySelector('[data-router-mode="hash"]') === null };
  })).toEqual({ iframeFindsAbout: true, hostCannotFindAbout: true });
});

test("Q1245 Realm document initialization rejects a foreign origin and cancels a pending same-origin navigation", async ({ page }) => {
  await addSlot(page, "realm-document-slot");
  const invalid = await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    await state.runtime.destroy();
    state.runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false },
      realmDocumentUrl: "http://127.0.0.1:5174/__micro_frame__/realm.html" });
    state.runtime.errors.subscribe(({ name, phase, error }) => state.errors.push({ name, phase, message: String(error) }));
    try {
      await state.runtime.mountApp({ name: "realm-document-guard", container: state.slots[0]!,
        entry: { type: "module", url: new URL("/upstream-runtime-counter.js", location.href).href } });
      return "resolved";
    } catch (error) { return String(error); }
  });
  expect(invalid).toContain("The Realm document URL must use the host document's HTTP(S) origin");
  await expect(page.locator("#realm-document-slot iframe, #realm-document-slot micro-app-host")).toHaveCount(0);
  await page.evaluate(() => { window.__upstreamRuntime__!.expectedErrors = [...window.__upstreamRuntime__!.errors]; });
  let releaseRequest = () => {};
  let observedRequest = () => {};
  const requestHeld = new Promise<void>(resolve => { observedRequest = resolve; });
  const released = new Promise<void>(resolve => { releaseRequest = resolve; });
  await page.route("**/__micro_frame__/held-realm.html", async route => {
    observedRequest();
    await released;
    await route.abort().catch(() => {});
  });
  try {
    await page.evaluate(async () => {
      const state = window.__upstreamRuntime__!;
      await state.runtime.destroy();
      state.runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false },
        realmDocumentUrl: "/__micro_frame__/held-realm.html" });
      state.runtime.errors.subscribe(({ name, phase, error }) => state.errors.push({ name, phase, message: String(error) }));
      const operation = state.runtime.mountApp({ name: "pending-realm-document", container: state.slots[0]!,
        entry: { type: "module", url: new URL("/upstream-runtime-counter.js", location.href).href } })
        .then(handle => { state.handles.push(handle); });
      state.operations.push(operation);
    });
    await requestHeld;
    await expect(page.locator("#realm-document-slot iframe")).toHaveCount(1);
    await page.evaluate(() => window.__upstreamRuntime__!.runtime.destroy());
    await expect(page.locator("#realm-document-slot iframe, #realm-document-slot micro-app-host")).toHaveCount(0);
  } finally { releaseRequest(); }
});
