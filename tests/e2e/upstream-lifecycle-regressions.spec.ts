import type { AppHandle } from "@micro-framework/contracts";
import type { MicroRuntime } from "@micro-framework/runtime";
import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";

isolateBrowserProcess(import.meta.url);

interface LifecycleRegressionState {
  runtime: MicroRuntime;
  handles: AppHandle[];
  slots: HTMLElement[];
  errors: string[];
  originalFrame?: HTMLIFrameElement;
  originalHost?: HTMLElement;
  originalSheet?: CSSStyleSheet;
}

declare global {
  interface Window {
    __upstreamLifecycleCase__?: LifecycleRegressionState;
  }
}

// These exercise generalized upstream scenarios; they do not run the original third-party packages.
const counterEntry = `
let count = 0;
export function mount(props) {
  const button = document.createElement('button');
  button.dataset.instanceId = props.$runtime.instanceId;
  const render = () => { button.textContent = props.title + ': ' + count; };
  button.addEventListener('click', () => { count++; render(); });
  render();
  props.container.appendChild(button);
}
export function unmount(props) { props.container.replaceChildren(); }
`;

let pageErrors: string[];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/upstream-counter-entry.js", (route) => route.fulfill({
    contentType: "text/javascript", body: counterEntry,
  }));
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
  await page.evaluate(() => {
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
    const errors: string[] = [];
    runtime.errors.subscribe(({ phase, error }) => errors.push(`${phase}: ${String(error)}`));
    window.__upstreamLifecycleCase__ = { runtime, errors, handles: [], slots: [] };
  });
});

test.afterEach(async ({ page }) => {
  const remaining = await page.evaluate(async () => {
    const state = window.__upstreamLifecycleCase__;
    if (!state) return { hosts: 0, frames: 0, errors: [] };
    await state.runtime.destroy();
    const result = {
      hosts: state.slots.reduce((count, slot) => count + slot.querySelectorAll("micro-app-host").length, 0),
      frames: state.slots.reduce((count, slot) => count + slot.querySelectorAll("iframe").length, 0),
      errors: state.errors,
    };
    for (const slot of state.slots) slot.remove();
    delete window.__upstreamLifecycleCase__;
    return result;
  });
  expect(remaining).toEqual({ hosts: 0, frames: 0, errors: [] });
  expect(pageErrors).toEqual([]);
});

test("W116 retains CSSOM-inserted rules when the same keepAlive surface is reactivated", async ({ page }) => {
  await page.route("**/upstream-cssom-entry.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `
      export function bootstrap() {
        const style = document.createElement('style');
        style.dataset.cssomRegression = '';
        document.head.appendChild(style);
        style.sheet.insertRule('.cssom-regression { color: rgb(17, 85, 153); padding-left: 13px; }', 0);
      }
      export function mount(props) {
        const probe = document.createElement('p');
        probe.className = 'cssom-regression';
        probe.textContent = 'CSSOM rule survives activation';
        props.container.appendChild(probe);
      }
      export function unmount(props) { props.container.replaceChildren(); }
    `,
  }));
  await page.evaluate(async () => {
    const state = window.__upstreamLifecycleCase__!;
    const slot = document.body.appendChild(document.createElement("div"));
    slot.id = "cssom-regression-slot";
    state.slots.push(slot);
    state.handles.push(await state.runtime.mountApp({
      name: "cssom-regression", container: slot, keepAlive: true,
      entry: { type: "module", url: new URL("/upstream-cssom-entry.js", location.href).href },
    }));
    state.originalHost = slot.querySelector<HTMLElement>("micro-app-host")!;
    state.originalFrame = state.originalHost.querySelector("iframe")!;
    state.originalSheet = state.originalHost.shadowRoot!
      .querySelector<HTMLStyleElement>("style[data-cssom-regression]")!.sheet!;
  });
  const host = page.locator("#cssom-regression-slot micro-app-host");
  const probe = host.locator(".cssom-regression");
  await expect(probe).toBeVisible();
  await expect(probe).toHaveCSS("color", "rgb(17, 85, 153)");
  await page.evaluate(() => window.__upstreamLifecycleCase__!.handles[0]!.unmount());
  await expect(probe).toBeHidden();
  await expect(host).toHaveAttribute("hidden");
  await expect(host).toHaveAttribute("inert");
  await page.evaluate(() => window.__upstreamLifecycleCase__!.handles[0]!.mount());
  await expect(probe).toBeVisible();
  await expect(probe).toHaveCSS("color", "rgb(17, 85, 153)");
  await expect(probe).toHaveCSS("padding-left", "13px");
  expect(await page.evaluate(() => {
    const state = window.__upstreamLifecycleCase__!;
    const current = state.slots[0]!.querySelector("micro-app-host")!;
    const style = current.shadowRoot!.querySelector<HTMLStyleElement>("style[data-cssom-regression]")!;
    return {
      sameHost: current === state.originalHost,
      sameFrame: current.querySelector("iframe") === state.originalFrame,
      sameSheet: style.sheet === state.originalSheet,
      ruleCount: style.sheet!.cssRules.length,
      textContent: style.textContent,
    };
  })).toEqual({ sameHost: true, sameFrame: true, sameSheet: true, ruleCount: 1, textContent: "" });
  await expect(host).toHaveCount(1);
  await expect(host.locator("iframe")).toHaveCount(1);
});

test("W823 remounts a React application twice with working event handlers and one surface", async ({ page }) => {
  await page.evaluate(async () => {
    const state = window.__upstreamLifecycleCase__!;
    const slot = document.body.appendChild(document.createElement("div"));
    slot.id = "react-remount-regression-slot";
    state.slots.push(slot);
    state.handles.push(await state.runtime.mountApp({
      name: "react-remount-regression", container: slot,
      entry: { type: "module", url: "http://127.0.0.1:5175/src/lifecycle.tsx" },
      props: { title: "React remount regression", locale: "en-US", period: "live" },
    }));
  });
  const host = page.locator("#react-remount-regression-slot micro-app-host");
  for (let cycle = 0; cycle < 3; cycle++) {
    await expect(host).toHaveCount(1);
    await expect(host.locator("iframe")).toHaveCount(1);
    await expect(host.locator("#react-root")).toContainText("React remount regression");
    await expect(host.getByRole("button", { name: "24h", exact: true })).toHaveClass(/is-active/);
    const chart = host.locator(".chart-plot polyline").first();
    const originalPoints = await chart.getAttribute("points");
    expect(originalPoints).toBeTruthy();
    const week = host.getByRole("button", { name: "7d", exact: true });
    await week.click();
    await expect(week).toHaveClass(/is-active/);
    await expect(chart).not.toHaveAttribute("points", originalPoints!);
    if (cycle === 2) break;
    await page.evaluate(() => window.__upstreamLifecycleCase__!.handles[0]!.unmount());
    await expect(host).toHaveCount(0);
    await expect(page.locator("#react-remount-regression-slot iframe")).toHaveCount(0);
    await page.evaluate(() => window.__upstreamLifecycleCase__!.handles[0]!.mount());
  }
});

test("Q2368 assigns fresh identities when a middle same-app tab is replaced at the same DOM position", async ({ page }) => {
  await page.evaluate(async () => {
    const state = window.__upstreamLifecycleCase__!;
    for (const label of ["first", "middle", "last"]) {
      const slot = document.body.appendChild(document.createElement("div"));
      slot.id = `tab-${label}`;
      state.slots.push(slot);
      state.handles.push(await state.runtime.mountApp({
        name: "same-tab-application", container: slot,
        entry: { type: "module", url: new URL("/upstream-counter-entry.js", location.href).href },
        props: { title: label },
      }));
    }
  });
  await page.locator("#tab-first").getByRole("button", { name: "first: 0" }).click();
  await page.locator("#tab-last").getByRole("button", { name: "last: 0" }).click();
  const identities = await page.evaluate(async () => {
    const state = window.__upstreamLifecycleCase__!;
    const originalIds = state.handles.map((handle) => handle.instanceId);
    const firstFrame = state.slots[0]!.querySelector("iframe");
    const lastFrame = state.slots[2]!.querySelector("iframe");
    const middle = state.slots[1]!;
    await state.handles[1]!.dispose();
    const replacement = document.createElement("div");
    replacement.id = "tab-replacement";
    middle.replaceWith(replacement);
    state.slots.push(replacement);
    const handle = await state.runtime.mountApp({
      name: "same-tab-application", container: replacement,
      entry: { type: "module", url: new URL("/upstream-counter-entry.js", location.href).href },
      props: { title: "replacement" },
    });
    state.handles.push(handle);
    return {
      allIds: [...originalIds, handle.instanceId],
      retainedFrames: firstFrame === state.slots[0]!.querySelector("iframe")
        && lastFrame === state.slots[2]!.querySelector("iframe"),
      correctPosition: replacement.previousElementSibling === state.slots[0]
        && replacement.nextElementSibling === state.slots[2],
      removedMiddleChildren: middle.childElementCount,
    };
  });
  expect(new Set(identities.allIds).size).toBe(4);
  expect(identities).toMatchObject({ retainedFrames: true, correctPosition: true, removedMiddleChildren: 0 });
  await expect(page.locator("micro-app-host")).toHaveCount(3);
  await expect(page.locator("micro-app-host iframe")).toHaveCount(3);
  const renderedIds = await page.locator("micro-app-host button[data-instance-id]")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-instance-id")));
  expect(new Set(renderedIds)).toEqual(new Set([identities.allIds[0], identities.allIds[2], identities.allIds[3]]));
  await expect(page.locator("#tab-first").getByRole("button")).toHaveText("first: 1");
  await expect(page.locator("#tab-last").getByRole("button")).toHaveText("last: 1");
  const replacementButton = page.locator("#tab-replacement").getByRole("button");
  await expect(replacementButton).toHaveText("replacement: 0");
  await replacementButton.click();
  await expect(replacementButton).toHaveText("replacement: 1");
});

test("Q578 keeps host styles inserted after application unmount in the host document", async ({ page }) => {
  const ownership = await page.evaluate(async () => {
    const state = window.__upstreamLifecycleCase__!;
    const slot = document.body.appendChild(document.createElement("div"));
    state.slots.push(slot);
    const appendChild = document.head.appendChild;
    const handle = await state.runtime.mountApp({
      name: "host-style-regression", container: slot,
      entry: { type: "module", url: new URL("/upstream-counter-entry.js", location.href).href },
      props: { title: "application" },
    });
    state.handles.push(handle);
    const oldHost = slot.querySelector("micro-app-host")!;
    await handle.unmount();
    const probe = document.createElement("p");
    probe.id = "host-route-style-probe";
    probe.textContent = "Host route content";
    slot.appendChild(probe);
    const style = document.createElement("style");
    style.textContent = "#host-route-style-probe { color: rgb(153, 34, 85); }";
    document.head.appendChild(style);
    return {
      nativeAppendUnchanged: document.head.appendChild === appendChild,
      parentIsHostHead: style.parentNode === document.head,
      staleSurfaceHasStyle: oldHost.shadowRoot!.contains(style),
      oldHostConnected: oldHost.isConnected,
    };
  });
  expect(ownership).toEqual({ nativeAppendUnchanged: true, parentIsHostHead: true, staleSurfaceHasStyle: false, oldHostConnected: false });
  await expect(page.locator("#host-route-style-probe")).toBeVisible();
  await expect(page.locator("#host-route-style-probe")).toHaveCSS("color", "rgb(153, 34, 85)");
  await expect(page.locator("micro-app-host")).toHaveCount(0);
});
