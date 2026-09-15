# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: upstream-batch02-runtime-switching.spec.ts >> Q2346 rapid native tab switching leaves hidden Realms unable to intercept host or application clicks (keepAlive=false)
- Location: tests/e2e/upstream-batch02-runtime-switching.spec.ts:7:3

# Error details

```
Error: locator.click: Test ended.
Call log:
  - waiting for getByRole('link', { name: 'Route B', exact: true })
    - locator resolved to <a href="#/b">Route B</a>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is not stable
  - retrying click action
    - waiting for element to be visible, enabled and stable
  - element was detached from the DOM, retrying

```

# Test source

```ts
  1  | import { isolateBrowserProcess } from "./browser-process-fixture";
  2  | import { addSlot, expect, expectStatus, installRouteLinks, test } from "./upstream-runtime-fixture";
  3  | 
  4  | isolateBrowserProcess(import.meta.url);
  5  | 
  6  | for (const keepAlive of [false, true]) {
  7  |   test(`Q2346 rapid native tab switching leaves hidden Realms unable to intercept host or application clicks (keepAlive=${keepAlive})`, async ({ page }) => {
  8  |     await addSlot(page, "rapid-tab-slot");
  9  |     await installRouteLinks(page);
  10 |     await page.route("**/batch02-rapid-tab.js", route => route.fulfill({ contentType: "text/javascript", body: `
  11 |       let count = 0;
  12 |       export async function mount(props) {
  13 |         await props.$runtime.services.call('rapidTabReady', '$call');
  14 |         const button = document.createElement('button');
  15 |         const render = () => button.textContent = props.title + ': ' + count;
  16 |         button.onclick = () => { count++; render(); };
  17 |         render(); props.container.appendChild(button);
  18 |       }
  19 |       export function unmount(props) { props.container.replaceChildren(); }
  20 |     ` }));
  21 |     await page.evaluate(async keepAlive => {
  22 |       const state = window.__upstreamRuntime__!;
  23 |       let ready = false;
  24 |       const waiting: Array<() => void> = [];
  25 |       state.calls.rapidTabPending = 0;
  26 |       state.runtime.services.set("rapidTabReady", () => {
  27 |         state.calls.rapidTabPending!++;
  28 |         return ready ? Promise.resolve() : new Promise<void>(resolve => waiting.push(resolve));
  29 |       });
  30 |       state.releases.rapidTab = () => { ready = true; for (const resolve of waiting) resolve(); };
  31 |       const hostButton = document.body.appendChild(document.createElement("button"));
  32 |       hostButton.id = "rapid-host-counter"; hostButton.textContent = "Host clicks: 0";
  33 |       hostButton.onclick = () => {
  34 |         state.calls.hostClicks = (state.calls.hostClicks ?? 0) + 1;
  35 |         hostButton.textContent = `Host clicks: ${state.calls.hostClicks}`;
  36 |       };
  37 |       state.slots.push(hostButton);
  38 |       state.runtime.registerApps(["a", "b"].map(name => ({
  39 |         name: `rapid-${name}`, container: state.slots[0]!, activeWhen: `/${name}`, keepAlive,
  40 |         entry: { type: "module" as const, url: new URL("/batch02-rapid-tab.js", location.href).href },
  41 |         props: { title: name.toUpperCase() },
  42 |       })));
  43 |       await state.runtime.start();
  44 |     }, keepAlive);
  45 |     await page.getByRole("link", { name: "Route A", exact: true }).click();
  46 |     await expect.poll(() => page.evaluate(() => window.__upstreamRuntime__!.calls.rapidTabPending)).toBe(1);
  47 |     for (let index = 0; index < 12; index++) {
> 48 |       await page.getByRole("link", { name: `Route ${index % 2 === 0 ? "B" : "A"}`, exact: true }).click();
     |                                                                                                   ^ Error: locator.click: Test ended.
  49 |     }
  50 |     await page.getByRole("link", { name: "Route B", exact: true }).click();
  51 |     await page.evaluate(() => window.__upstreamRuntime__!.releases.rapidTab!());
  52 |     await expectStatus(page, "rapid-b", "mounted");
  53 |     await expect(page.locator("#rapid-tab-slot micro-app-host:not([hidden])")).toHaveCount(1);
  54 |     const app = page.locator('#rapid-tab-slot micro-app-host[data-micro-app="rapid-b"]');
  55 |     await app.getByRole("button").click();
  56 |     await expect(app.getByRole("button")).toHaveText("B: 1");
  57 |     await page.locator("#rapid-host-counter").click();
  58 |     await expect(page.locator("#rapid-host-counter")).toHaveText("Host clicks: 1");
  59 |     const hitTest = await page.evaluate(() => {
  60 |       const frames = [...document.querySelectorAll<HTMLIFrameElement>("#rapid-tab-slot iframe")];
  61 |       const host = document.querySelector<HTMLElement>('#rapid-tab-slot micro-app-host[data-micro-app="rapid-b"]')!;
  62 |       const button = host.shadowRoot!.querySelector("button")!;
  63 |       const bounds = button.getBoundingClientRect();
  64 |       return {
  65 |         frames: frames.map(frame => ({ hidden: frame.hidden,
  66 |           width: frame.getBoundingClientRect().width, height: frame.getBoundingClientRect().height })),
  67 |         hostHit: document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) === host,
  68 |         appHit: host.shadowRoot!.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) === button,
  69 |       };
  70 |     });
  71 |     expect(hitTest.frames.length).toBeGreaterThan(0);
  72 |     // Undistributed light-DOM children have no computed style in some engines.
  73 |     // Their hidden state, zero geometry, and actual hit targets establish that
  74 |     // they cannot paint over the host or intercept the native clicks above.
  75 |     for (const frame of hitTest.frames) expect(frame).toEqual({ hidden: true, width: 0, height: 0 });
  76 |     expect({ hostHit: hitTest.hostHit, appHit: hitTest.appHit }).toEqual({ hostHit: true, appHit: true });
  77 |   });
  78 | }
  79 | 
```