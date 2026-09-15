import { isolateBrowserProcess } from './browser-process-fixture';
import { addSlot, expect, expectStatus, installRouteLinks, routeTo, test } from './upstream-runtime-fixture';

isolateBrowserProcess(import.meta.url);
const entryURL = 'http://127.0.0.1:5176/src/upstream-batch03/runtime-entry.ts';

test('W1003 recreates real Vue Router and vue-i18n instances after A-B-A lifecycle destruction', async ({ page }) => {
  await addSlot(page, 'vue-slot'); await installRouteLinks(page);
  await page.evaluate(async entryURL => {
    const s = window.__upstreamRuntime__!;
    s.runtime.registerApps([{ name: 'vue-singleton', container: s.slots[0]!, activeWhen: '/a', keepAlive: false,
      entry: { type: 'module', url: entryURL }, props: { route: '/home', locale: 'zh' } }]);
    await s.runtime.start();
  }, entryURL);
  for (let round = 0; round < 2; round++) {
    await routeTo(page, 'a'); await expectStatus(page, 'vue-singleton', 'mounted');
    await expect(page.locator('[data-greeting]')).toHaveText('欢迎');
    await expect(page.locator('[data-route]')).toHaveText('/home');
    await page.getByRole('button', { name: 'Open details', exact: true }).click();
    await expect(page.locator('[data-route]')).toHaveText('/details');
    await page.getByRole('button', { name: 'Vue count: 0', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Vue count: 1', exact: true })).toBeVisible();
    await routeTo(page, 'b'); await expectStatus(page, 'vue-singleton', 'unmounted');
    await expect(page.locator('#vue-slot iframe, #vue-slot micro-app-host')).toHaveCount(0);
  }
});

test('W1043 W1031 W1030 forwards host route props and history state into a real Vue router without rewriting native location', async ({ page }) => {
  await addSlot(page, 'vue-route-slot');
  await page.evaluate(async entryURL => {
    const s = window.__upstreamRuntime__!;
    history.replaceState({ secret: 'host-private' }, '', location.href);
    s.handles.push(await s.runtime.mountApp({ name: 'vue-router-state', container: s.slots[0]!,
      entry: { type: 'module', url: entryURL }, props: { route: '/home', routeState: { secret: 'initial-private' } } }));
  }, entryURL);
  const hostURL = page.url();
  await expect(page.locator('[data-route]')).toHaveText('/home');
  await expect(page.locator('[data-history-state]')).toHaveText('initial-private');
  await page.evaluate(() => window.__upstreamRuntime__!.handles[0]!.update({ route: '/orders?filter=open', routeState: { secret: 'order-private' } }));
  await expect(page.locator('[data-route]')).toHaveText('/orders?filter=open');
  await expect(page.locator('[data-history-state]')).toHaveText('order-private');
  await page.getByRole('button', { name: 'Open details', exact: true }).click();
  await expect(page.locator('[data-route]')).toHaveText('/details');
  await expect(page.locator('[data-history-state]')).toHaveText('child-secret');
  await page.getByRole('button', { name: 'Child back', exact: true }).click();
  await expect(page.locator('[data-route]')).toHaveText('/orders?filter=open');
  await expect(page.locator('[data-history-state]')).toHaveText('order-private');
  expect(page.url()).toBe(hostURL);
  expect(await page.evaluate(() => {
    const frame = window.__upstreamRuntime__!.slots[0]!.querySelector('iframe')!;
    return { hostSecret: history.state.secret, childSecret: frame.contentWindow!.history.state.secret,
      childOrigin: frame.contentWindow!.location.origin, hostOrigin: location.origin,
      nativeLocation: frame.contentWindow!.location === frame.contentDocument!.location,
      route: frame.contentWindow!.location.pathname };
  })).toEqual({ hostSecret: 'host-private', childSecret: 'order-private', childOrigin: new URL(hostURL).origin,
    hostOrigin: new URL(hostURL).origin, nativeLocation: true, route: '/orders' });
});

test('W1020 delivers host route events to an alive Vue router across hidden and reactivated states exactly once', async ({ page }) => {
  await addSlot(page, 'alive-route-slot'); await installRouteLinks(page);
  await page.evaluate(async entryURL => {
    const s = window.__upstreamRuntime__!;
    s.runtime.registerApps([{ name: 'alive-router', container: s.slots[0]!, activeWhen: '/a', keepAlive: true,
      entry: { type: 'module', url: entryURL }, props: { route: '/home' } }]); await s.runtime.start();
  }, entryURL);
  await routeTo(page, 'a'); await expectStatus(page, 'alive-router', 'mounted');
  await page.getByRole('button', { name: 'Vue count: 0', exact: true }).click();
  await page.evaluate(() => window.__upstreamRuntime__!.runtime.events.emit('route-change', { page: '/first' }));
  await expect(page.locator('[data-route]')).toHaveText('/first');
  await routeTo(page, 'b'); await expectStatus(page, 'alive-router', 'unmounted');
  await page.evaluate(() => window.__upstreamRuntime__!.runtime.events.emit('route-change', { page: '/while-hidden' }));
  await expect(page.locator('[data-route]')).toHaveText('/while-hidden');
  await routeTo(page, 'a'); await expectStatus(page, 'alive-router', 'mounted');
  await expect(page.locator('[data-route]')).toHaveText('/while-hidden');
  await expect(page.getByRole('button', { name: 'Vue count: 1', exact: true })).toBeVisible();
  await page.evaluate(() => window.__upstreamRuntime__!.runtime.events.emit('route-change', { page: '/after-return' }));
  await expect(page.locator('[data-route]')).toHaveText('/after-return');
  await page.getByRole('button', { name: 'Child back', exact: true }).click();
  await expect(page.locator('[data-route]')).toHaveText('/while-hidden');
});
