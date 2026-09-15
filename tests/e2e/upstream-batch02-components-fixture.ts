import type { AppHandle } from "@micro-framework/contracts";
import type { MicroRuntime } from "@micro-framework/runtime";
import { expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    __batch02Components__?: {
      runtime: MicroRuntime; handle: AppHandle | undefined; slot: HTMLElement; errors: string[];
      hostMouseEvent: typeof MouseEvent; hostFocusEvent: typeof FocusEvent;
      hostAddListener: typeof EventTarget.prototype.addEventListener;
    };
  }
}
export async function mountBatch02(page: Page, scenario: string, options: { nested?: boolean; local?: boolean; entry?: string; globalName?: string } = {}): Promise<void> {
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
  await page.evaluate(async ({ scenario, options }) => {
    const lead = document.createElement("div"); lead.style.height = "260px";
    const slot = document.createElement("main"); slot.id = "batch02-slot";
    slot.style.cssText = "margin-left:140px;width:780px";
    const tail = document.createElement("div"); tail.style.height = "900px";
    document.body.append(lead, slot, tail);
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
    const errors: string[] = [];
    runtime.errors.subscribe(({ phase, error }) => errors.push(`${phase}: ${String(error)}`));
    const entry = options.entry ?? (scenario === "drawer" || scenario === "style-prop"
      ? `http://127.0.0.1:5179/src/upstream-batch02/${scenario === "drawer" ? "drawer" : "style-prop"}-entry.ts`
      : `http://127.0.0.1:5180/src/batch02/${options.nested ? "nested-entry" : "lifecycle"}.ts`);
    const state: NonNullable<Window["__batch02Components__"]> = {
      runtime, handle: undefined, slot, errors, hostMouseEvent: MouseEvent, hostFocusEvent: FocusEvent,
      hostAddListener: EventTarget.prototype.addEventListener,
    };
    window.__batch02Components__ = state;
    state.handle = await runtime.mountApp({
      name: "batch02-parent", container: slot,
      entry: options.globalName ? { type: "html", url: entry, globalName: options.globalName } : { type: "module", url: entry },
      props: { scenario, local: options.local ?? false, label: "Initial business label", childEntry: "http://127.0.0.1:5180/src/batch02/lifecycle.ts" },
    });
    window.scrollTo(0, 180);
  }, { scenario, options });
  const selector = scenario === "drawer" || scenario === "style-prop" ? `.batch02-vue2-${scenario}` : `.batch02-${scenario}`;
  await expect(page.locator(selector)).toHaveAttribute("data-ready", "true");
  if (options.nested) {
    await expect(page.locator(".batch02-parent-scroll")).toHaveAttribute("data-ready", "true");
    await page.locator(".batch02-parent-scroll").evaluate((element) => { element.scrollTop = 180; });
  }
}

export async function destroyBatch02(page: Page): Promise<void> {
  const result = await page.evaluate(async () => {
    const state = window.__batch02Components__;
    if (!state) return null;
    await state.runtime.destroy();
    const result = {
      remaining: state.slot.querySelectorAll("iframe, micro-app-host").length, errors: state.errors,
      hostUnchanged: state.hostMouseEvent === MouseEvent && state.hostFocusEvent === FocusEvent
        && state.hostAddListener === EventTarget.prototype.addEventListener,
    };
    delete window.__batch02Components__;
    return result;
  });
  if (result) expect(result).toEqual({ remaining: 0, errors: [], hostUnchanged: true });
}

export async function expectNestedRealms(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const parentHost = document.querySelector("#batch02-slot micro-app-host")!;
    const parentFrame = parentHost.querySelector("iframe")!;
    const childHost = parentHost.shadowRoot!.querySelector("micro-app-host")!;
    const childFrame = childHost.querySelector("iframe")!;
    const childRoot = childHost.shadowRoot!.querySelector<HTMLElement>(".batch02-component")!;
    return {
      distinct: parentFrame.contentWindow !== childFrame.contentWindow && parentFrame.contentWindow !== window && childFrame.contentWindow !== window,
      owned: childFrame.contentDocument?.querySelector(".batch02-component") === childRoot,
      hostInvisible: document.querySelector(".batch02-component") === null,
      marker: childRoot.dataset.realm,
    };
  });
  expect(result).toEqual({ distinct: true, owned: true, hostInvisible: true, marker: "application" });
}
