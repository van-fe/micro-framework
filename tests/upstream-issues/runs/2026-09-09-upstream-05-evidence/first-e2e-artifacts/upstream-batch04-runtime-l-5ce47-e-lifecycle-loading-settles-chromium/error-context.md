# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: upstream-batch04-runtime-loading.spec.ts >> Q3001 Q3093 manual load failure preserves host and sibling while lifecycle loading settles
- Location: tests/e2e/upstream-batch04-runtime-loading.spec.ts:6:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

@@ -1,7 +1,7 @@
  Object {
-   "failedStatus": "error",
+   "failedStatus": "disposed",
    "host": "Host: 1",
    "hostConnected": true,
    "mounts": 0,
    "sameFrame": true,
    "successStatus": "mounted",
```

# Page snapshot

```yaml
- generic [active]:
  - main
```

# Test source

```ts
  1   | import { isolateBrowserProcess } from './browser-process-fixture';
  2   | import { addSlot, counterEntry, expect, expectStatus, installRouteLinks, routeTo, test } from './upstream-runtime-fixture';
  3   | 
  4   | isolateBrowserProcess(import.meta.url);
  5   | 
  6   | test('Q3001 Q3093 manual load failure preserves host and sibling while lifecycle loading settles', async ({ page }) => {
  7   |   await addSlot(page, 'sibling'); await addSlot(page, 'failed');
  8   |   await page.route('**/batch04-failed.html', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  9   |   await page.evaluate(async () => {
  10  |     const s = window.__upstreamRuntime__!;
  11  |     const host = document.body.appendChild(document.createElement('button'));
  12  |     host.dataset.upstreamRuntime = ''; host.textContent = 'Host: 0';
  13  |     host.onclick = () => { s.calls.hostClicks = (s.calls.hostClicks ?? 0) + 1; host.textContent = `Host: ${s.calls.hostClicks}`; };
  14  |     s.originalHost = host;
  15  |     Object.assign(window, { batch04HostLifecycle: {
  16  |       mount: () => { s.calls.hostMount = (s.calls.hostMount ?? 0) + 1; },
  17  |       unmount: () => { s.calls.hostUnmount = (s.calls.hostUnmount ?? 0) + 1; },
  18  |     } });
  19  |     s.handles.push(await s.runtime.mountApp({ name: 'sibling', container: s.slots[0]!,
  20  |       entry: { type: 'module', url: new URL('/upstream-runtime-counter.js', location.href).href }, props: { title: 'Sibling' } }));
  21  |     s.originalFrame = s.slots[0]!.querySelector('iframe')!;
  22  |   });
  23  |   await page.getByRole('button', { name: 'Sibling: 0', exact: true }).click();
  24  |   const failure = await page.evaluate(async () => {
  25  |     const s = window.__upstreamRuntime__!;
  26  |     try { await s.runtime.mountApp({ name: 'failed', container: s.slots[1]!,
  27  |       entry: { type: 'html', url: new URL('/batch04-failed.html', location.href).href, globalName: 'batch04HostLifecycle' } }); return ''; }
  28  |     catch (error) { s.expectedErrors = [...s.errors]; return String(error); }
  29  |   });
  30  |   expect(failure).toContain('All application entries failed');
  31  |   await page.getByRole('button', { name: 'Host: 0', exact: true }).click();
  32  |   await page.getByRole('button', { name: 'Sibling: 1', exact: true }).click();
  33  |   await expect(page.getByRole('button', { name: 'Sibling: 2', exact: true })).toBeVisible();
  34  |   await expect(page.locator('#failed iframe, #failed micro-app-host')).toHaveCount(0);
  35  |   expect(await page.evaluate(() => {
  36  |     const s = window.__upstreamRuntime__!;
  37  |     return { sameFrame: s.originalFrame === s.slots[0]!.querySelector('iframe'), host: s.originalHost!.textContent,
  38  |       hostConnected: s.originalHost!.isConnected, mounts: s.calls.hostMount ?? 0, unmounts: s.calls.hostUnmount ?? 0,
  39  |       successStatus: s.lifecycle.filter(e => e.name === 'sibling').at(-1)?.status,
  40  |       failedStatus: s.lifecycle.filter(e => e.name === 'failed').at(-1)?.status };
> 41  |   })).toEqual({ sameFrame: true, host: 'Host: 1', hostConnected: true, mounts: 0, unmounts: 0,
      |       ^ Error: expect(received).toEqual(expected) // deep equality
  42  |     successStatus: 'mounted', failedStatus: 'error' });
  43  | });
  44  | 
  45  | test('W1057 configured load timeout removes a delayed entry Realm and permits recovery at the same URL', async ({ page }) => {
  46  |   await addSlot(page, 'timeout-slot');
  47  |   let release!: () => void;
  48  |   const gate = new Promise<void>(resolve => { release = resolve; });
  49  |   let requested = 0;
  50  |   await page.route('**/batch04-delayed.js', async route => {
  51  |     requested++; if (requested === 1) await gate;
  52  |     await route.fulfill({ contentType: 'text/javascript', body: counterEntry }).catch(() => {});
  53  |   });
  54  |   await page.evaluate(async () => {
  55  |     const s = window.__upstreamRuntime__!; await s.runtime.destroy();
  56  |     s.runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false }, timeouts: { load: 1000 } });
  57  |     s.runtime.errors.subscribe(({ name, phase, error }) => s.errors.push({ name, phase, message: String(error) }));
  58  |     s.operations.push(s.runtime.mountApp({ name: 'slow', container: s.slots[0]!,
  59  |       entry: { type: 'module', url: new URL('/batch04-delayed.js', location.href).href }, props: { title: 'Recovered' } })
  60  |       .then(handle => { s.handles.push(handle); }, error => { s.calls.failed = 1; s.expectedErrors = [...s.errors]; s.calls.timeout = String(error).includes('exceeded') ? 1 : 0; }));
  61  |   });
  62  |   try {
  63  |     await expect.poll(() => requested).toBe(1);
  64  |     await expect.poll(() => page.evaluate(() => window.__upstreamRuntime__!.calls.failed)).toBe(1);
  65  |     expect(await page.evaluate(() => window.__upstreamRuntime__!.calls.timeout)).toBe(1);
  66  |     await expect(page.locator('#timeout-slot iframe, #timeout-slot micro-app-host')).toHaveCount(0);
  67  |   } finally { release(); }
  68  |   await page.evaluate(async () => {
  69  |     const s = window.__upstreamRuntime__!;
  70  |     s.handles.push(await s.runtime.mountApp({ name: 'slow', container: s.slots[0]!,
  71  |       entry: { type: 'module', url: new URL('/batch04-delayed.js', location.href).href }, props: { title: 'Recovered' } }));
  72  |   });
  73  |   await page.getByRole('button', { name: 'Recovered: 0', exact: true }).click();
  74  |   await expect(page.getByRole('button', { name: 'Recovered: 1', exact: true })).toBeVisible();
  75  |   expect(requested).toBeGreaterThanOrEqual(2);
  76  | });
  77  | 
  78  | for (const keepAlive of [false, true]) test(`W976 W1017 delayed resource A-B-A switching retains one interactive application (keepAlive=${keepAlive})`, async ({ page }) => {
  79  |   await addSlot(page, 'race-slot'); await installRouteLinks(page);
  80  |   let release!: () => void;
  81  |   const gate = new Promise<void>(resolve => { release = resolve; });
  82  |   let requests = 0;
  83  |   await page.route('**/batch04-race-a.js', async route => {
  84  |     requests++; if (requests === 1) await gate;
  85  |     await route.fulfill({ contentType: 'text/javascript', body: counterEntry });
  86  |   });
  87  |   await page.evaluate(async keepAlive => {
  88  |     const s = window.__upstreamRuntime__!;
  89  |     s.runtime.registerApps(['a', 'b'].map(name => ({ name: `race-${name}`, container: s.slots[0]!, keepAlive,
  90  |       activeWhen: `/${name}`, props: { title: name.toUpperCase() },
  91  |       entry: { type: 'module' as const, url: new URL(name === 'a' ? '/batch04-race-a.js' : '/upstream-runtime-counter.js', location.href).href } })));
  92  |     await s.runtime.start();
  93  |   }, keepAlive);
  94  |   try {
  95  |     await routeTo(page, 'a'); await expect.poll(() => requests).toBe(1);
  96  |     await routeTo(page, 'b'); await routeTo(page, 'a');
  97  |   } finally { release(); }
  98  |   await expectStatus(page, 'race-a', 'mounted');
  99  |   await page.getByRole('button', { name: 'A: 0', exact: true }).click();
  100 |   await expect(page.getByRole('button', { name: 'A: 1', exact: true })).toBeVisible();
  101 |   await expect(page.getByRole('button', { name: /^B:/ })).not.toBeVisible();
  102 |   await routeTo(page, 'b'); await expectStatus(page, 'race-b', 'mounted');
  103 |   await page.getByRole('button', { name: 'B: 0', exact: true }).click();
  104 |   await routeTo(page, 'a'); await expectStatus(page, 'race-a', 'mounted');
  105 |   await expect(page.getByRole('button', { name: `A: ${keepAlive ? 1 : 0}`, exact: true })).toBeVisible();
  106 | });
  107 | 
```