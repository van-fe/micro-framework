import { isolateBrowserProcess } from "./browser-process-fixture";
import { addSlot, counterEntry, expect, expectStatus, installRouteLinks, routeTo, test } from "./upstream-runtime-fixture";

isolateBrowserProcess(import.meta.url);

const reactEntry = "http://127.0.0.1:5175/src/upstream-runtime-lifecycle.tsx";

for (const keepAlive of [false, true]) {
  test(`Q1089 serializes remount behind an unfinished unmount (keepAlive=${keepAlive})`, async ({ page }) => {
    await addSlot(page, "race-slot");
    await page.evaluate(async (keepAlive) => {
      const state = window.__upstreamRuntime__!;
      state.runtime.registerApps([], { beforeUnmount() {
        state.calls.beforeUnmount = (state.calls.beforeUnmount ?? 0) + 1;
        if (state.calls.beforeUnmount === 1) return new Promise<void>((resolve) => { state.releases.unmount = resolve; });
      } });
      const handle = await state.runtime.mountApp({
        name: "interleaved", container: state.slots[0]!, keepAlive,
        entry: { type: "module", url: new URL("/upstream-runtime-counter.js", location.href).href },
        props: { title: "Interleaved" },
      });
      state.handles.push(handle);
      state.originalHost = state.slots[0]!.querySelector("micro-app-host")!;
      state.originalFrame = state.slots[0]!.querySelector("iframe")!;
    }, keepAlive);
    const button = page.locator("#race-slot").getByRole("button");
    await button.click();
    await expect(button).toHaveText("Interleaved: 1");
    await page.evaluate(() => {
      const state = window.__upstreamRuntime__!;
      state.operations.push(state.handles[0]!.unmount());
    });
    await page.waitForFunction(() => Boolean(window.__upstreamRuntime__!.releases.unmount));
    await page.evaluate(() => {
      const state = window.__upstreamRuntime__!;
      state.operations.push(state.handles[0]!.mount());
      state.operations.push(state.handles[0]!.mount());
    });
    expect(await page.evaluate(() => window.__upstreamRuntime__!.handles[0]!.getStatus())).toBe("unmounting");
    await page.evaluate(async () => {
      const state = window.__upstreamRuntime__!;
      state.releases.unmount!();
      await Promise.all(state.operations);
    });
    expect(await page.evaluate(() => window.__upstreamRuntime__!.handles[0]!.getStatus())).toBe("mounted");
    await expect(button).toHaveText(`Interleaved: ${keepAlive ? 1 : 0}`);
    await button.click();
    await expect(button).toHaveText(`Interleaved: ${keepAlive ? 2 : 1}`);
    expect(await page.evaluate(() => {
      const state = window.__upstreamRuntime__!;
      return {
        sameHost: state.originalHost === state.slots[0]!.querySelector("micro-app-host"),
        sameFrame: state.originalFrame === state.slots[0]!.querySelector("iframe"),
        oldFrameConnected: state.originalFrame!.isConnected,
        beforeUnmount: state.calls.beforeUnmount,
      };
    })).toEqual({ sameHost: keepAlive, sameFrame: keepAlive, oldFrameConnected: keepAlive, beforeUnmount: 1 });
    await expect(page.locator("#race-slot micro-app-host")).toHaveCount(1);
    await expect(page.locator("#race-slot iframe")).toHaveCount(1);
  });
}

test("Q1089 cancels an unfinished first mount before honoring the newest mount request", async ({ page }) => {
  await addSlot(page, "mount-race-slot");
  await page.route("**/upstream-runtime-pending-mount.js", (route) => route.fulfill({
    contentType: "text/javascript", body: counterEntry,
  }));
  await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    state.runtime.registerApps([{
      name: "pending-mount", activeWhen: "/a", container: state.slots[0]!,
      entry: { type: "module", url: new URL("/upstream-runtime-pending-mount.js", location.href).href },
      props: { title: "Newest" },
    }], { beforeMount() {
      state.calls.beforeMount = (state.calls.beforeMount ?? 0) + 1;
      if (state.calls.beforeMount === 1) return new Promise<void>((resolve) => { state.releases.mount = resolve; });
    } });
    await state.runtime.start();
  });
  await installRouteLinks(page);
  await routeTo(page, "a");
  await page.waitForFunction(() => Boolean(window.__upstreamRuntime__!.releases.mount));
  await page.evaluate(() => {
    const state = window.__upstreamRuntime__!;
    const handle = state.runtime.getAppHandle("pending-mount")!;
    state.handles.push(handle);
    state.originalFrame = state.slots[0]!.querySelector("iframe")!;
    state.operations.push(handle.unmount(), handle.mount());
  });
  await expectStatus(page, "pending-mount", "mounted");
  const button = page.locator("#mount-race-slot").getByRole("button");
  await button.click();
  await expect(button).toHaveText("Newest: 1");
  expect(await page.evaluate(() => ({
    oldFrameConnected: window.__upstreamRuntime__!.originalFrame!.isConnected,
    beforeMount: window.__upstreamRuntime__!.calls.beforeMount,
  }))).toEqual({ oldFrameConnected: false, beforeMount: 2 });
  await expect(page.locator("#mount-race-slot micro-app-host")).toHaveCount(1);
});

test("Q1089 lets a newer unmount supersede a mount waiting behind asynchronous teardown", async ({ page }) => {
  await addSlot(page, "superseded-slot");
  await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    state.runtime.registerApps([], { beforeUnmount() {
      state.calls.beforeUnmount = (state.calls.beforeUnmount ?? 0) + 1;
      return new Promise<void>((resolve) => { state.releases.unmount = resolve; });
    } });
    const handle = await state.runtime.mountApp({
      name: "superseded", container: state.slots[0]!,
      entry: { type: "module", url: new URL("/upstream-runtime-counter.js", location.href).href },
      props: { title: "Superseded" },
    });
    state.handles.push(handle);
    state.operations.push(handle.unmount());
  });
  await page.waitForFunction(() => Boolean(window.__upstreamRuntime__!.releases.unmount));
  await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    const handle = state.handles[0]!;
    state.operations.push(handle.mount(), handle.unmount(), handle.unmount());
    state.releases.unmount!();
    await Promise.all(state.operations);
  });
  expect(await page.evaluate(() => ({
    status: window.__upstreamRuntime__!.handles[0]!.getStatus(),
    unmounts: window.__upstreamRuntime__!.calls.beforeUnmount,
  }))).toEqual({ status: "unmounted", unmounts: 1 });
  await expect(page.locator("#superseded-slot micro-app-host, #superseded-slot iframe")).toHaveCount(0);
});


test("Q1089 serializes a reentrant mount requested by an unmounting lifecycle listener", async ({ page }) => {
  await addSlot(page, "reentrant-slot");
  await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    const handle = await state.runtime.mountApp({
      name: "reentrant", container: state.slots[0]!,
      entry: { type: "module", url: new URL("/upstream-runtime-counter.js", location.href).href },
      props: { title: "Reentrant" },
    });
    state.handles.push(handle);
    state.originalFrame = state.slots[0]!.querySelector("iframe")!;
    const unsubscribe = state.runtime.lifecycle.subscribe((event) => {
      if (event.name === "reentrant" && event.status === "unmounting") {
        unsubscribe();
        state.operations.push(handle.mount());
      }
    });
    await handle.unmount();
    await Promise.all(state.operations);
  });
  const button = page.locator("#reentrant-slot").getByRole("button");
  await expect(button).toHaveText("Reentrant: 0");
  await button.click();
  await expect(button).toHaveText("Reentrant: 1");
  expect(await page.evaluate(() => ({
    status: window.__upstreamRuntime__!.handles[0]!.getStatus(),
    oldFrameConnected: window.__upstreamRuntime__!.originalFrame!.isConnected,
  }))).toEqual({ status: "mounted", oldFrameConnected: false });
  await expect(page.locator("#reentrant-slot micro-app-host")).toHaveCount(1);
  await expect(page.locator("#reentrant-slot iframe")).toHaveCount(1);
});

for (const { keepAlive, delayPhase } of [
  { keepAlive: false, delayPhase: "beforeUnmount" },
  { keepAlive: false, delayPhase: "unmount" },
  { keepAlive: true, delayPhase: "beforeUnmount" },
  { keepAlive: true, delayPhase: "deactivate" },
] as const) {
  test(`W823 awaits asynchronous React ${delayPhase} before ${keepAlive ? "reactivating" : "remounting"} with working events (keepAlive=${keepAlive})`, async ({ page }) => {
    await addSlot(page, "react-delayed-slot");
    await page.evaluate(async ({ entry, delayPhase, keepAlive }) => {
      const state = window.__upstreamRuntime__!;
      const wait = () => {
        state.calls.delay = (state.calls.delay ?? 0) + 1;
        if (state.calls.delay > 1) return Promise.resolve();
        return new Promise<void>((resolve) => { state.releases.unmount = resolve; });
      };
      if (delayPhase === "beforeUnmount") state.runtime.registerApps([], { beforeUnmount: wait });
      state.runtime.services.set("unmount", { wait });
      state.handles.push(await state.runtime.mountApp({
        name: "react-async-unmount", container: state.slots[0]!, keepAlive, entry: { type: "module", url: entry },
        props: {
          title: "React delayed", delayedUnmount: delayPhase === "unmount", delayedDeactivate: delayPhase === "deactivate",
        },
      }));
      state.originalFrame = state.slots[0]!.querySelector("iframe")!;
      state.originalHost = state.slots[0]!.querySelector("micro-app-host")!;
    }, { entry: reactEntry, delayPhase, keepAlive });
    const button = page.locator("#react-delayed-slot").getByRole("button");
    await expect(button).toHaveText("React delayed: 0");
    await button.click();
    await expect(button).toHaveText("React delayed: 1");
    await page.evaluate(() => {
      const state = window.__upstreamRuntime__!;
      state.operations.push(state.handles[0]!.unmount());
    });
    await page.waitForFunction(() => Boolean(window.__upstreamRuntime__!.releases.unmount));
    await page.evaluate(() => {
      const state = window.__upstreamRuntime__!;
      state.operations.push(state.handles[0]!.mount());
    });
    expect(await page.evaluate(() => window.__upstreamRuntime__!.handles[0]!.getStatus())).toBe("unmounting");
    await expect(button).toHaveText("React delayed: 1");
    await page.evaluate(async () => {
      const state = window.__upstreamRuntime__!;
      state.releases.unmount!();
      await Promise.all(state.operations);
    });
    await expect(button).toHaveText(`React delayed: ${keepAlive ? 1 : 0}`);
    await button.click();
    await expect(button).toHaveText(`React delayed: ${keepAlive ? 2 : 1}`);
    expect(await page.evaluate(() => ({
      status: window.__upstreamRuntime__!.handles[0]!.getStatus(),
      oldFrameConnected: window.__upstreamRuntime__!.originalFrame!.isConnected,
      sameFrame: window.__upstreamRuntime__!.originalFrame === window.__upstreamRuntime__!.slots[0]!.querySelector("iframe"),
      sameHost: window.__upstreamRuntime__!.originalHost === window.__upstreamRuntime__!.slots[0]!.querySelector("micro-app-host"),
      delayCalls: window.__upstreamRuntime__!.calls.delay,
    }))).toEqual({ status: "mounted", oldFrameConnected: keepAlive, sameFrame: keepAlive, sameHost: keepAlive, delayCalls: 1 });
    await expect(page.locator("#react-delayed-slot micro-app-host")).toHaveCount(1);
    await expect(page.locator("#react-delayed-slot iframe")).toHaveCount(1);
  });
}

test("Q222 switches applications from real AntD confirm.onOk without an event teardown error", async ({ page }) => {
  await addSlot(page, "confirm-slot");
  await installRouteLinks(page);
  await page.evaluate(async (entry) => {
    const state = window.__upstreamRuntime__!;
    state.runtime.registerApps([
      { name: "confirm-a", container: state.slots[0]!, activeWhen: "/a",
        entry: { type: "module", url: entry }, props: { title: "Confirm A", confirmNavigation: true } },
      { name: "confirm-b", container: state.slots[0]!, activeWhen: "/b",
        entry: { type: "module", url: new URL("/upstream-runtime-counter.js", location.href).href }, props: { title: "Confirm B" } },
    ]);
    await state.runtime.start();
  }, reactEntry);
  await routeTo(page, "a");
  await expectStatus(page, "confirm-a", "mounted");
  await page.evaluate(() => { window.__upstreamRuntime__!.originalFrame = document.querySelector("#confirm-slot iframe")!; });
  await page.getByRole("button", { name: "Open switch confirmation" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Switch to B" }).click();
  await expectStatus(page, "confirm-b", "mounted");
  await expectStatus(page, "confirm-a", "unmounted");
  await expect(dialog).toHaveCount(0);
  const button = page.locator("#confirm-slot").getByRole("button");
  await button.click();
  await expect(button).toHaveText("Confirm B: 1");
  expect(await page.evaluate(() => ({
    oldFrameConnected: window.__upstreamRuntime__!.originalFrame!.isConnected,
    mounts: window.__upstreamRuntime__!.lifecycle.filter((event) => event.name === "confirm-b" && event.status === "mounted").length,
    hostContainsConfirm: document.querySelector(".ant-modal-confirm") !== null,
  }))).toEqual({ oldFrameConnected: false, mounts: 1, hostContainsConfirm: false });
  await expect(page.locator("#confirm-slot micro-app-host")).toHaveCount(1);
  await expect(page.locator("#confirm-slot iframe")).toHaveCount(1);
});
