# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: upstream-batch03-resources.spec.ts >> Q3035 W1005 resolve static and dynamic image and SVG href before requests with host same-name decoys
- Location: tests/e2e/upstream-batch03-resources.spec.ts:22:1

# Error details

```
Error: page.evaluate: [object Event]
```

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 7

- Array []
+ Array [
+   Object {
+     "message": "[object Event]",
+     "name": "images",
+     "phase": "mount",
+   },
+ ]
```

# Page snapshot

```yaml
- generic [active]:
  - main
```

# Test source

```ts
  1   | import type { AppHandle, LifecycleEvent, RuntimeErrorEvent } from "@micro-frame/contracts";
  2   | import type { MicroRuntime } from "@micro-frame/runtime";
  3   | import type { Page } from "@playwright/test";
  4   | import { expect, test as base } from "./browser-process-fixture";
  5   | 
  6   | export interface RuntimeRegressionState {
  7   |   runtime: MicroRuntime;
  8   |   handles: AppHandle[];
  9   |   slots: HTMLElement[];
  10  |   errors: Array<{ name?: string; phase: string; message: string }>;
  11  |   lifecycle: LifecycleEvent[];
  12  |   expectedErrors: Array<{ name?: string; phase: string; message: string }>;
  13  |   originalFrame?: HTMLIFrameElement;
  14  |   originalHost?: HTMLElement;
  15  |   releases: Record<string, () => void>;
  16  |   calls: Record<string, number>;
  17  |   operations: Promise<unknown>[];
  18  | }
  19  | 
  20  | declare global {
  21  |   interface Window { __upstreamRuntime__?: RuntimeRegressionState; }
  22  | }
  23  | 
  24  | export const counterEntry = `
  25  | let count = 0;
  26  | export function mount(props) {
  27  |   const button = document.createElement('button');
  28  |   button.dataset.instanceId = props.$runtime.instanceId;
  29  |   const render = () => { button.textContent = props.title + ': ' + count; };
  30  |   button.addEventListener('click', () => { count++; render(); });
  31  |   render();
  32  |   props.container.appendChild(button);
  33  | }
  34  | export function unmount(props) { props.container.replaceChildren(); }
  35  | `;
  36  | 
  37  | export const test = base.extend<{ runtimeCase: void }>({
  38  |   runtimeCase: [async ({ page }, use) => {
  39  |     const pageErrors: string[] = [];
  40  |     page.on("pageerror", (error) => pageErrors.push(error.message));
  41  |     await page.route("**/upstream-runtime-counter.js", (route) => route.fulfill({
  42  |       contentType: "text/javascript", body: counterEntry,
  43  |     }));
  44  |     await page.goto("/benchmark.html");
  45  |     await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
  46  |     await page.evaluate(() => {
  47  |       const runtime = window.__createMicroFrameBenchmarkRuntime__!({
  48  |         routing: { mode: "hash" }, storage: { persistent: false }, concurrency: "single",
  49  |       });
  50  |       const state: RuntimeRegressionState = {
  51  |         runtime, handles: [], slots: [], errors: [], expectedErrors: [], lifecycle: [],
  52  |         releases: {}, calls: {}, operations: [],
  53  |       };
  54  |       runtime.errors.subscribe(({ name, phase, error }: RuntimeErrorEvent) => {
  55  |         state.errors.push({ name, phase, message: String(error) });
  56  |       });
  57  |       runtime.lifecycle.subscribe((event) => state.lifecycle.push(event));
  58  |       window.__upstreamRuntime__ = state;
  59  |     });
  60  |     try { await use(); }
  61  |     finally {
  62  |       const result = await page.evaluate(async () => {
  63  |         const state = window.__upstreamRuntime__;
  64  |         if (!state) return { errors: [], expectedErrors: [], children: document.querySelectorAll("micro-app-host, iframe").length };
  65  |         for (const release of Object.values(state.releases)) release();
  66  |         await Promise.allSettled(state.operations);
  67  |         await state.runtime.destroy();
  68  |         const result = {
  69  |           errors: state.errors, expectedErrors: state.expectedErrors,
  70  |           children: state.slots.reduce((count, slot) => count + slot.querySelectorAll("micro-app-host, iframe").length, 0),
  71  |         };
  72  |         state.slots.forEach((slot) => slot.remove());
  73  |         document.querySelectorAll("[data-upstream-runtime]").forEach((element) => element.remove());
  74  |         delete window.__upstreamRuntime__;
  75  |         return result;
  76  |       });
> 77  |       expect(result.errors).toEqual(result.expectedErrors);
      |                             ^ Error: expect(received).toEqual(expected) // deep equality
  78  |       expect(result.children).toBe(0);
  79  |       expect(pageErrors).toEqual([]);
  80  |     }
  81  |   }, { auto: true }],
  82  | });
  83  | 
  84  | export { expect };
  85  | 
  86  | export async function addSlot(page: Page, id: string): Promise<void> {
  87  |   await page.evaluate((id) => {
  88  |     const slot = document.body.appendChild(document.createElement("div"));
  89  |     slot.id = id;
  90  |     window.__upstreamRuntime__!.slots.push(slot);
  91  |   }, id);
  92  | }
  93  | 
  94  | export async function installRouteLinks(page: Page): Promise<void> {
  95  |   await page.evaluate(() => {
  96  |     const nav = document.body.appendChild(document.createElement("nav"));
  97  |     nav.dataset.upstreamRuntime = "";
  98  |     for (const name of ["a", "b", "host"]) {
  99  |       const link = nav.appendChild(document.createElement("a"));
  100 |       link.href = `#/${name}`;
  101 |       link.textContent = `Route ${name.toUpperCase()}`;
  102 |       link.style.marginRight = "20px";
  103 |     }
  104 |   });
  105 | }
  106 | 
  107 | export async function routeTo(page: Page, name: "a" | "b" | "host"): Promise<void> {
  108 |   await page.getByRole("link", { name: `Route ${name.toUpperCase()}`, exact: true }).click();
  109 |   await expect(page).toHaveURL(new RegExp(`#/${name}$`));
  110 | }
  111 | 
  112 | export async function expectStatus(page: Page, name: string, status: string): Promise<void> {
  113 |   await expect.poll(() => page.evaluate((name) =>
  114 |     window.__upstreamRuntime__!.runtime.getAppStatus(name), name)).toBe(status);
  115 | }
  116 | 
```