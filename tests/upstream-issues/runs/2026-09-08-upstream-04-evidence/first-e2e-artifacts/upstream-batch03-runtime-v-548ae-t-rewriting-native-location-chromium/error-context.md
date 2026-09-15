# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: upstream-batch03-runtime-vue.spec.ts >> W1043 W1031 W1030 forwards host route props and history state into a real Vue router without rewriting native location
- Location: tests/e2e/upstream-batch03-runtime-vue.spec.ts:28:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  locator('[data-route]')
Expected: "/orders?filter=open"
Received: "/orders"
Timeout:  5000ms

Call log:
  - Expect "toHaveText" with timeout 5000ms
  - waiting for locator('[data-route]')
    14 × locator resolved to <p data-route="">/orders</p>
       - unexpected value "/orders"

```

```yaml
- paragraph: /orders
```

# Test source

```ts
  1  | import { isolateBrowserProcess } from './browser-process-fixture';
  2  | import { addSlot, expect, expectStatus, installRouteLinks, routeTo, test } from './upstream-runtime-fixture';
  3  | 
  4  | isolateBrowserProcess(import.meta.url);
  5  | const entryURL = 'http://127.0.0.1:5176/src/upstream-batch03/runtime-entry.ts';
  6  | 
  7  | test('W1003 recreates real Vue Router and vue-i18n instances after A-B-A lifecycle destruction', async ({ page }) => {
  8  |   await addSlot(page, 'vue-slot'); await installRouteLinks(page);
  9  |   await page.evaluate(async entryURL => {
  10 |     const s = window.__upstreamRuntime__!;
  11 |     s.runtime.registerApps([{ name: 'vue-singleton', container: s.slots[0]!, activeWhen: '/a', keepAlive: false,
  12 |       entry: { type: 'module', url: entryURL }, props: { route: '/home', locale: 'zh' } }]);
  13 |     await s.runtime.start();
  14 |   }, entryURL);
  15 |   for (let round = 0; round < 2; round++) {
  16 |     await routeTo(page, 'a'); await expectStatus(page, 'vue-singleton', 'mounted');
  17 |     await expect(page.locator('[data-greeting]')).toHaveText('欢迎');
  18 |     await expect(page.locator('[data-route]')).toHaveText('/home');
  19 |     await page.getByRole('button', { name: 'Open details', exact: true }).click();
  20 |     await expect(page.locator('[data-route]')).toHaveText('/details');
  21 |     await page.getByRole('button', { name: 'Vue count: 0', exact: true }).click();
  22 |     await expect(page.getByRole('button', { name: 'Vue count: 1', exact: true })).toBeVisible();
  23 |     await routeTo(page, 'b'); await expectStatus(page, 'vue-singleton', 'unmounted');
  24 |     await expect(page.locator('#vue-slot iframe, #vue-slot micro-app-host')).toHaveCount(0);
  25 |   }
  26 | });
  27 | 
  28 | test('W1043 W1031 W1030 forwards host route props and history state into a real Vue router without rewriting native location', async ({ page }) => {
  29 |   await addSlot(page, 'vue-route-slot');
  30 |   await page.evaluate(async entryURL => {
  31 |     const s = window.__upstreamRuntime__!;
  32 |     history.replaceState({ secret: 'host-private' }, '', location.href);
  33 |     s.handles.push(await s.runtime.mountApp({ name: 'vue-router-state', container: s.slots[0]!,
  34 |       entry: { type: 'module', url: entryURL }, props: { route: '/home', routeState: { secret: 'initial-private' } } }));
  35 |   }, entryURL);
  36 |   const hostURL = page.url();
  37 |   await expect(page.locator('[data-route]')).toHaveText('/home');
  38 |   await expect(page.locator('[data-history-state]')).toHaveText('initial-private');
  39 |   await page.evaluate(() => window.__upstreamRuntime__!.handles[0]!.update({ route: '/orders?filter=open', routeState: { secret: 'order-private' } }));
> 40 |   await expect(page.locator('[data-route]')).toHaveText('/orders?filter=open');
     |                                              ^ Error: expect(locator).toHaveText(expected) failed
  41 |   await expect(page.locator('[data-history-state]')).toHaveText('order-private');
  42 |   await page.getByRole('button', { name: 'Open details', exact: true }).click();
  43 |   await expect(page.locator('[data-route]')).toHaveText('/details');
  44 |   await expect(page.locator('[data-history-state]')).toHaveText('child-secret');
  45 |   await page.getByRole('button', { name: 'Child back', exact: true }).click();
  46 |   await expect(page.locator('[data-route]')).toHaveText('/orders?filter=open');
  47 |   await expect(page.locator('[data-history-state]')).toHaveText('order-private');
  48 |   expect(page.url()).toBe(hostURL);
  49 |   expect(await page.evaluate(() => {
  50 |     const frame = window.__upstreamRuntime__!.slots[0]!.querySelector('iframe')!;
  51 |     return { hostSecret: history.state.secret, childSecret: frame.contentWindow!.history.state.secret,
  52 |       childOrigin: frame.contentWindow!.location.origin, hostOrigin: location.origin,
  53 |       nativeLocation: frame.contentWindow!.location === frame.contentDocument!.location,
  54 |       route: frame.contentWindow!.location.pathname };
  55 |   })).toEqual({ hostSecret: 'host-private', childSecret: 'order-private', childOrigin: new URL(hostURL).origin,
  56 |     hostOrigin: new URL(hostURL).origin, nativeLocation: true, route: '/orders' });
  57 | });
  58 | 
  59 | test('W1020 delivers host route events to an alive Vue router across hidden and reactivated states exactly once', async ({ page }) => {
  60 |   await addSlot(page, 'alive-route-slot'); await installRouteLinks(page);
  61 |   await page.evaluate(async entryURL => {
  62 |     const s = window.__upstreamRuntime__!;
  63 |     s.runtime.registerApps([{ name: 'alive-router', container: s.slots[0]!, activeWhen: '/a', keepAlive: true,
  64 |       entry: { type: 'module', url: entryURL }, props: { route: '/home' } }]); await s.runtime.start();
  65 |   }, entryURL);
  66 |   await routeTo(page, 'a'); await expectStatus(page, 'alive-router', 'mounted');
  67 |   await page.getByRole('button', { name: 'Vue count: 0', exact: true }).click();
  68 |   await page.evaluate(() => window.__upstreamRuntime__!.runtime.events.emit('route-change', { page: '/first' }));
  69 |   await expect(page.locator('[data-route]')).toHaveText('/first');
  70 |   await routeTo(page, 'b'); await expectStatus(page, 'alive-router', 'unmounted');
  71 |   await page.evaluate(() => window.__upstreamRuntime__!.runtime.events.emit('route-change', { page: '/while-hidden' }));
  72 |   await expect(page.locator('[data-route]')).toHaveText('/while-hidden');
  73 |   await routeTo(page, 'a'); await expectStatus(page, 'alive-router', 'mounted');
  74 |   await expect(page.locator('[data-route]')).toHaveText('/while-hidden');
  75 |   await expect(page.getByRole('button', { name: 'Vue count: 1', exact: true })).toBeVisible();
  76 |   await page.evaluate(() => window.__upstreamRuntime__!.runtime.events.emit('route-change', { page: '/after-return' }));
  77 |   await expect(page.locator('[data-route]')).toHaveText('/after-return');
  78 |   await page.getByRole('button', { name: 'Child back', exact: true }).click();
  79 |   await expect(page.locator('[data-route]')).toHaveText('/while-hidden');
  80 | });
  81 | 
```