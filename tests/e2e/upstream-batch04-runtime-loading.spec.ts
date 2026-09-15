import { isolateBrowserProcess } from './browser-process-fixture';
import { addSlot, counterEntry, expect, expectStatus, installRouteLinks, routeTo, test } from './upstream-runtime-fixture';

isolateBrowserProcess(import.meta.url);

test('Q3001 Q3093 manual load failure preserves host and sibling while lifecycle loading settles', async ({ page }) => {
  await addSlot(page, 'sibling'); await addSlot(page, 'failed');
  await page.route('**/batch04-failed.html', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.evaluate(async () => {
    const s = window.__upstreamRuntime__!;
    const host = document.body.appendChild(document.createElement('button'));
    host.dataset.upstreamRuntime = ''; host.textContent = 'Host: 0';
    host.onclick = () => { s.calls.hostClicks = (s.calls.hostClicks ?? 0) + 1; host.textContent = `Host: ${s.calls.hostClicks}`; };
    s.originalHost = host;
    Object.assign(window, { batch04HostLifecycle: {
      mount: () => { s.calls.hostMount = (s.calls.hostMount ?? 0) + 1; },
      unmount: () => { s.calls.hostUnmount = (s.calls.hostUnmount ?? 0) + 1; },
    } });
    s.handles.push(await s.runtime.mountApp({ name: 'sibling', container: s.slots[0]!,
      entry: { type: 'module', url: new URL('/upstream-runtime-counter.js', location.href).href }, props: { title: 'Sibling' } }));
    s.originalFrame = s.slots[0]!.querySelector('iframe')!;
  });
  await page.getByRole('button', { name: 'Sibling: 0', exact: true }).click();
  const failure = await page.evaluate(async () => {
    const s = window.__upstreamRuntime__!;
    try { await s.runtime.mountApp({ name: 'failed', container: s.slots[1]!,
      entry: { type: 'html', url: new URL('/batch04-failed.html', location.href).href, globalName: 'batch04HostLifecycle' } }); return ''; }
    catch (error) { s.expectedErrors = [...s.errors]; return String(error); }
  });
  expect(failure).toContain('All application entries failed');
  await page.getByRole('button', { name: 'Host: 0', exact: true }).click();
  await page.getByRole('button', { name: 'Sibling: 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sibling: 2', exact: true })).toBeVisible();
  await expect(page.locator('#failed iframe, #failed micro-app-host')).toHaveCount(0);
  expect(await page.evaluate(() => {
    const s = window.__upstreamRuntime__!;
    return { sameFrame: s.originalFrame === s.slots[0]!.querySelector('iframe'), host: s.originalHost!.textContent,
      hostConnected: s.originalHost!.isConnected, mounts: s.calls.hostMount ?? 0, unmounts: s.calls.hostUnmount ?? 0,
      successStatus: s.lifecycle.filter(e => e.name === 'sibling').at(-1)?.status,
      failedStatus: s.lifecycle.filter(e => e.name === 'failed').at(-1)?.status,
      failureObserved: s.lifecycle.some(e => e.name === 'failed' && e.status === 'error') };
  })).toEqual({ sameFrame: true, host: 'Host: 1', hostConnected: true, mounts: 0, unmounts: 0,
    successStatus: 'mounted', failedStatus: 'disposed', failureObserved: true });
});

test('W1057 configured load timeout removes a delayed entry Realm and permits recovery at the same URL', async ({ page }) => {
  await addSlot(page, 'timeout-slot');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requested = 0;
  await page.route('**/batch04-delayed.js', async route => {
    requested++; if (requested === 1) await gate;
    await route.fulfill({ contentType: 'text/javascript', body: counterEntry }).catch(() => {});
  });
  await page.evaluate(async () => {
    const s = window.__upstreamRuntime__!; await s.runtime.destroy();
    s.runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false }, timeouts: { load: 1000 } });
    s.runtime.errors.subscribe(({ name, phase, error }) => s.errors.push({ name, phase, message: String(error) }));
    s.operations.push(s.runtime.mountApp({ name: 'slow', container: s.slots[0]!,
      entry: { type: 'module', url: new URL('/batch04-delayed.js', location.href).href }, props: { title: 'Recovered' } })
      .then(handle => { s.handles.push(handle); }, error => { s.calls.failed = 1; s.expectedErrors = [...s.errors]; s.calls.timeout = String(error).includes('exceeded') ? 1 : 0; }));
  });
  try {
    await expect.poll(() => requested).toBe(1);
    await expect.poll(() => page.evaluate(() => window.__upstreamRuntime__!.calls.failed)).toBe(1);
    expect(await page.evaluate(() => window.__upstreamRuntime__!.calls.timeout)).toBe(1);
    await expect(page.locator('#timeout-slot iframe, #timeout-slot micro-app-host')).toHaveCount(0);
  } finally { release(); }
  await page.evaluate(async () => {
    const s = window.__upstreamRuntime__!;
    s.handles.push(await s.runtime.mountApp({ name: 'slow', container: s.slots[0]!,
      entry: { type: 'module', url: new URL('/batch04-delayed.js', location.href).href }, props: { title: 'Recovered' } }));
  });
  await page.getByRole('button', { name: 'Recovered: 0', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Recovered: 1', exact: true })).toBeVisible();
  expect(requested).toBeGreaterThanOrEqual(2);
});

for (const keepAlive of [false, true]) test(`W976 W1017 delayed resource A-B-A switching retains one interactive application (keepAlive=${keepAlive})`, async ({ page }) => {
  await addSlot(page, 'race-slot'); await installRouteLinks(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requests = 0;
  await page.route('**/batch04-race-a.js', async route => {
    requests++; if (requests === 1) await gate;
    await route.fulfill({ contentType: 'text/javascript', body: counterEntry });
  });
  await page.evaluate(async keepAlive => {
    const s = window.__upstreamRuntime__!;
    s.runtime.registerApps(['a', 'b'].map(name => ({ name: `race-${name}`, container: s.slots[0]!, keepAlive,
      activeWhen: `/${name}`, props: { title: name.toUpperCase() },
      entry: { type: 'module' as const, url: new URL(name === 'a' ? '/batch04-race-a.js' : '/upstream-runtime-counter.js', location.href).href } })));
    await s.runtime.start();
  }, keepAlive);
  try {
    await routeTo(page, 'a'); await expect.poll(() => requests).toBe(1);
    await routeTo(page, 'b'); await routeTo(page, 'a');
  } finally { release(); }
  await expectStatus(page, 'race-a', 'mounted');
  await page.getByRole('button', { name: 'A: 0', exact: true }).click();
  await expect(page.getByRole('button', { name: 'A: 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^B:/ })).not.toBeVisible();
  await routeTo(page, 'b'); await expectStatus(page, 'race-b', 'mounted');
  await page.getByRole('button', { name: 'B: 0', exact: true }).click();
  await routeTo(page, 'a'); await expectStatus(page, 'race-a', 'mounted');
  await expect(page.getByRole('button', { name: `A: ${keepAlive ? 1 : 0}`, exact: true })).toBeVisible();
});

for (const succeeds of [true, false]) test(`Q3093 native lifecycle loading indicator clears after manual load (success=${succeeds})`, async ({ page }) => {
  await addSlot(page, 'loading-ui-slot');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await page.route('**/batch04-loading-ui.html', async route => {
    requested = true; await gate;
    await route.fulfill({ status: succeeds ? 200 : 503, contentType: 'text/html',
      body: succeeds ? '<script type="module" src="/upstream-runtime-counter.js"></script>' : 'Unavailable' });
  });
  await page.evaluate(() => {
    const s = window.__upstreamRuntime__!;
    const indicator = document.body.appendChild(document.createElement('p'));
    indicator.id = 'runtime-loading'; indicator.dataset.upstreamRuntime = ''; indicator.hidden = true;
    indicator.setAttribute('role', 'status'); indicator.textContent = 'Loading application';
    s.runtime.lifecycle.subscribe(event => {
      if (event.name !== 'loading-ui') return;
      const loading = ['resolving', 'loading', 'bootstrapping', 'bootstrapped', 'mounting'].includes(event.status);
      indicator.hidden = !loading; indicator.dataset.loading = String(loading);
    });
    s.operations.push(s.runtime.mountApp({ name: 'loading-ui', container: s.slots[0]!,
      entry: { type: 'html', url: new URL('/batch04-loading-ui.html', location.href).href }, props: { title: 'Loaded' } })
      .then(handle => { s.handles.push(handle); s.calls.settled = 1; }, () => { s.calls.settled = 1; s.expectedErrors = [...s.errors]; }));
  });
  try {
    await expect.poll(() => requested).toBe(true);
    await expect(page.locator('#runtime-loading')).toBeVisible();
    await expect(page.locator('#runtime-loading')).toHaveAttribute('data-loading', 'true');
  } finally { release(); }
  await expect.poll(() => page.evaluate(() => window.__upstreamRuntime__!.calls.settled)).toBe(1);
  await expect(page.locator('#runtime-loading')).toBeHidden();
  await expect(page.locator('#runtime-loading')).toHaveAttribute('data-loading', 'false');
  if (succeeds) {
    await page.getByRole('button', { name: 'Loaded: 0', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Loaded: 1', exact: true })).toBeVisible();
  } else {
    await expect(page.locator('#loading-ui-slot iframe, #loading-ui-slot micro-app-host')).toHaveCount(0);
    expect(await page.evaluate(() => window.__upstreamRuntime__!.lifecycle.some(event => event.name === 'loading-ui' && event.status === 'error'))).toBe(true);
  }
});
