import type { AppHandle, LifecycleEvent, RuntimeErrorEvent } from "@micro-framework/contracts";
import type { MicroRuntime } from "@micro-framework/runtime";
import type { Page } from "@playwright/test";
import { expect, test as base } from "./browser-process-fixture";

export interface RuntimeRegressionState {
  runtime: MicroRuntime;
  handles: AppHandle[];
  slots: HTMLElement[];
  errors: Array<{ name?: string; phase: string; message: string }>;
  lifecycle: LifecycleEvent[];
  expectedErrors: Array<{ name?: string; phase: string; message: string }>;
  originalFrame?: HTMLIFrameElement;
  originalHost?: HTMLElement;
  releases: Record<string, () => void>;
  calls: Record<string, number>;
  operations: Promise<unknown>[];
}

declare global {
  interface Window { __upstreamRuntime__?: RuntimeRegressionState; }
}

export const counterEntry = `
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

export const test = base.extend<{ runtimeCase: void }>({
  runtimeCase: [async ({ page }, use) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("**/upstream-runtime-counter.js", (route) => route.fulfill({
      contentType: "text/javascript", body: counterEntry,
    }));
    await page.goto("/benchmark.html");
    await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
    await page.evaluate(() => {
      const runtime = window.__createMicroFrameBenchmarkRuntime__!({
        routing: { mode: "hash" }, storage: { persistent: false }, concurrency: "single",
      });
      const state: RuntimeRegressionState = {
        runtime, handles: [], slots: [], errors: [], expectedErrors: [], lifecycle: [],
        releases: {}, calls: {}, operations: [],
      };
      runtime.errors.subscribe(({ name, phase, error }: RuntimeErrorEvent) => {
        state.errors.push({ name, phase, message: String(error) });
      });
      runtime.lifecycle.subscribe((event) => state.lifecycle.push(event));
      window.__upstreamRuntime__ = state;
    });
    try { await use(); }
    finally {
      const result = await page.evaluate(async () => {
        const state = window.__upstreamRuntime__;
        if (!state) return { errors: [], expectedErrors: [], children: document.querySelectorAll("micro-app-host, iframe").length };
        for (const release of Object.values(state.releases)) release();
        await Promise.allSettled(state.operations);
        await state.runtime.destroy();
        const result = {
          errors: state.errors, expectedErrors: state.expectedErrors,
          children: state.slots.reduce((count, slot) => count + slot.querySelectorAll("micro-app-host, iframe").length, 0),
        };
        state.slots.forEach((slot) => slot.remove());
        document.querySelectorAll("[data-upstream-runtime]").forEach((element) => element.remove());
        delete window.__upstreamRuntime__;
        return result;
      });
      expect(result.errors).toEqual(result.expectedErrors);
      expect(result.children).toBe(0);
      expect(pageErrors).toEqual([]);
    }
  }, { auto: true }],
});

export { expect };

export async function addSlot(page: Page, id: string): Promise<void> {
  await page.evaluate((id) => {
    const slot = document.body.appendChild(document.createElement("div"));
    slot.id = id;
    window.__upstreamRuntime__!.slots.push(slot);
  }, id);
}

export async function installRouteLinks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const nav = document.body.appendChild(document.createElement("nav"));
    nav.dataset.upstreamRuntime = "";
    for (const name of ["a", "b", "host"]) {
      const link = nav.appendChild(document.createElement("a"));
      link.href = `#/${name}`;
      link.textContent = `Route ${name.toUpperCase()}`;
      link.style.marginRight = "20px";
    }
  });
}

export async function routeTo(page: Page, name: "a" | "b" | "host"): Promise<void> {
  await page.getByRole("link", { name: `Route ${name.toUpperCase()}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#/${name}$`));
}

export async function expectStatus(page: Page, name: string, status: string): Promise<void> {
  await expect.poll(() => page.evaluate((name) =>
    window.__upstreamRuntime__!.runtime.getAppStatus(name), name)).toBe(status);
}
