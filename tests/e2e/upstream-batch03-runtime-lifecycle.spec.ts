import { isolateBrowserProcess } from './browser-process-fixture';
import { addSlot, expect, expectStatus, installRouteLinks, routeTo, test } from './upstream-runtime-fixture';

isolateBrowserProcess(import.meta.url);

test('Q3031 Q3005 isolates delayed manual unmount from an automatic instance of the same Vite Vue entry', async ({ page }) => {
  await addSlot(page, 'manual-slot'); await addSlot(page, 'registered-slot'); await installRouteLinks(page);
  await page.evaluate(async () => {
    const s = window.__upstreamRuntime__!;
    s.runtime.registerService('unmountGate', () => new Promise<void>(resolve => { s.calls.unmountEntered = 1; s.releases.manual = resolve; }));
    const entry = { type: 'module' as const, url: 'http://127.0.0.1:5176/src/upstream-batch03/runtime-entry.ts' };
    s.handles.push(await s.runtime.mountApp({ name: 'shared-app', entry, container: s.slots[0]!, props: { title: 'Manual', delayed: true } }));
    s.runtime.registerApps([{ name: 'shared-app', entry, container: s.slots[1]!, activeWhen: '/a', props: { title: 'Automatic' } }]);
    await s.runtime.start();
  });
  await routeTo(page, 'a'); await expectStatus(page, 'shared-app', 'mounted');
  await page.locator('#manual-slot').getByRole('button', { name: /^Vue count/ }).click();
  await page.locator('#registered-slot').getByRole('button', { name: /^Vue count/ }).click();
  await expect(page.locator('#manual-slot').getByRole('button', { name: /^Vue count/ })).toHaveText('Vue count: 1');
  await expect(page.locator('#registered-slot').getByRole('button', { name: /^Vue count/ })).toHaveText('Vue count: 1');
  await page.locator('#manual-slot').getByRole('button', { name: 'Open details', exact: true }).click();
  await expect(page.locator('#manual-slot [data-route]')).toHaveText('/details');
  await expect(page.locator('#registered-slot [data-route]')).toHaveText('/home');
  await expectStatus(page, 'shared-app', 'mounted');
  await page.evaluate(() => { const s = window.__upstreamRuntime__!; s.operations.push(s.handles[0]!.unmount()); });
  await expect.poll(() => page.evaluate(() => window.__upstreamRuntime__!.calls.unmountEntered)).toBe(1);
  await page.locator('#registered-slot').getByRole('button', { name: /^Vue count/ }).click();
  await page.evaluate(async () => { const s = window.__upstreamRuntime__!; s.releases.manual!(); await Promise.all(s.operations); });
  await expect(page.locator('#manual-slot micro-app-host')).toHaveCount(0);
  await expect(page.locator('#registered-slot').getByRole('button', { name: /^Vue count/ })).toHaveText('Vue count: 2');
  await routeTo(page, 'host'); await expectStatus(page, 'shared-app', 'unmounted');
});

test('W1054 supplies fresh login props after disposing and recreating an alive application', async ({ page }) => {
  await addSlot(page, 'props-slot');
  for (const token of ['first-login', 'second-login']) {
    await page.evaluate(async token => {
      const s = window.__upstreamRuntime__!;
      s.handles.push(await s.runtime.mountApp({ name: 'login-app', keepAlive: true, container: s.slots[0]!,
        entry: { type: 'module', url: new URL('/upstream-runtime-counter.js', location.href).href },
        props: async () => ({ title: token }) }));
    }, token);
    const button = page.locator('#props-slot').getByRole('button');
    await button.click(); await expect(button).toHaveText(`${token}: 1`);
    await page.evaluate(() => window.__upstreamRuntime__!.handles.at(-1)!.dispose());
    await expect(page.locator('#props-slot micro-app-host, #props-slot iframe')).toHaveCount(0);
  }
  expect(await page.evaluate(() => new Set(window.__upstreamRuntime__!.handles.map(h => h.instanceId)).size)).toBe(2);
});

test('Q2987 clears real Vue onBeforeUnmount intervals during a real route switch while a sibling clock continues', async ({ page }) => {
  await addSlot(page, 'timer-slot'); await addSlot(page, 'clock-slot'); await installRouteLinks(page);
  await page.route('**/batch03-timer.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    let timer;
    export function mount(props) {
      props.container.textContent = 'Timer ' + props.label;
      timer = setInterval(() => props.$runtime.events.emit('tick', props.label), 10);
    }
    export function unmount(props) { clearInterval(timer); props.container.replaceChildren(); }
  ` }));
  await page.evaluate(async () => {
    const s = window.__upstreamRuntime__!;
    for (const event of ['tick', 'vue-tick']) s.runtime.events.on<string>(event, label => { s.calls[label] = (s.calls[label] ?? 0) + 1; });
    const entry = { type: 'module' as const, url: new URL('/batch03-timer.js', location.href).href };
    s.handles.push(await s.runtime.mountApp({ name: 'sibling-clock', container: s.slots[1]!, entry, props: { label: 'sibling' } }));
    s.runtime.registerApps([{ name: 'timer-a', container: s.slots[0]!, activeWhen: '/a', entry: { type: 'module', url: 'http://127.0.0.1:5176/src/upstream-batch03/runtime-entry.ts' }, props: { label: 'child' } }]);
    await s.runtime.start();
  });
  await routeTo(page, 'a');
  await expect.poll(() => page.evaluate(() => window.__upstreamRuntime__!.calls.child ?? 0)).toBeGreaterThan(2);
  await routeTo(page, 'b'); await expectStatus(page, 'timer-a', 'unmounted');
  const snapshot = await page.evaluate(() => ({ ...window.__upstreamRuntime__!.calls }));
  await expect.poll(() => page.evaluate(() => window.__upstreamRuntime__!.calls.sibling!)).toBeGreaterThan(snapshot.sibling! + 10);
  expect(await page.evaluate(() => window.__upstreamRuntime__!.calls.child)).toBe(snapshot.child);
  await expect(page.locator('#timer-slot iframe, #timer-slot micro-app-host')).toHaveCount(0);
});
