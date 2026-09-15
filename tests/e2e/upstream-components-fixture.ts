import type { AppHandle } from "@micro-framework/contracts";
import type { MicroRuntime } from "@micro-framework/runtime";
import { expect, type Page } from "@playwright/test";

export const componentEntry = "http://127.0.0.1:5180/src/upstream/lifecycle.ts";

declare global {
  interface Window {
    __upstreamComponents__?: {
      runtime: MicroRuntime;
      handle: AppHandle;
      slot: HTMLElement;
      errors: string[];
      destroyHost?: () => void;
    };
  }
}

export async function mountComponent(page: Page, scenario: string, keepAlive = false): Promise<void> {
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
  await page.evaluate(async ({ entry, scenario, keepAlive }) => {
    const spacer = document.createElement("div");
    spacer.style.height = "420px";
    const slot = document.createElement("main");
    slot.id = "upstream-components-slot";
    slot.style.cssText = "margin-left:180px;width:780px;transform-origin:top left";
    const footer = document.createElement("div");
    footer.style.height = "1000px";
    document.body.append(spacer, slot, footer);
    let applicationContainer = slot;
    let destroyHost: (() => void) | undefined;
    if (scenario === "bpmn") {
      const hostUrl = "http://127.0.0.1:5180/src/upstream/vue2-host.ts";
      const { createVue2Host } = await import(hostUrl);
      const host = createVue2Host(slot);
      applicationContainer = host.slot;
      destroyHost = host.destroy;
    }
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
    const errors: string[] = [];
    runtime.errors.subscribe(({ phase, error }) => errors.push(`${phase}: ${String(error)}`));
    const handle = await runtime.mountApp({
      name: "upstream-components", container: applicationContainer, keepAlive,
      entry: { type: "module", url: entry }, props: { scenario },
    });
    window.__upstreamComponents__ = { runtime, handle, slot, errors, destroyHost };
    window.scrollTo(0, 320);
  }, { entry: componentEntry, scenario, keepAlive });
  await expect(page.locator(`.upstream-${scenario}`)).toHaveAttribute("data-ready", "true");
}

export async function destroyComponent(page: Page): Promise<void> {
  const result = await page.evaluate(async () => {
    const state = window.__upstreamComponents__;
    if (!state) return { remaining: 0, errors: [] };
    await state.runtime.destroy();
    state.destroyHost?.();
    const remaining = state.slot.querySelectorAll("iframe, micro-app-host").length;
    delete window.__upstreamComponents__;
    return { remaining, errors: state.errors };
  });
  expect(result).toEqual({ remaining: 0, errors: [] });
}

export async function assertRealmOwnership(page: Page, selector: string): Promise<void> {
  const result = await page.evaluate((selector) => {
    const host = document.querySelector("#upstream-components-slot micro-app-host")!;
    const frame = host.querySelector("iframe")!;
    return {
      host: document.querySelector(selector) !== null,
      shadow: Boolean(host.shadowRoot?.querySelector(selector)),
      realm: Boolean(frame.contentDocument?.querySelector(selector)),
    };
  }, selector);
  expect(result).toEqual({ host: false, shadow: true, realm: true });
}
