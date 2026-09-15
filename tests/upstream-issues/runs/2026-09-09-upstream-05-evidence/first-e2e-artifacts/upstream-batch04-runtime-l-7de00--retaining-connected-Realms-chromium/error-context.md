# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: upstream-batch04-runtime-lifecycle.spec.ts >> Q2991 repeatedly destroys real Vue 2 instances and subscriptions without retaining connected Realms
- Location: tests/e2e/upstream-batch04-runtime-lifecycle.spec.ts:6:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

  Object {
    "connected": false,
-   "destroyed": 1,
+   "destroyed": undefined,
    "replies": 1,
  }
```

# Page snapshot

```yaml
- generic [active]:
  - main
```

# Test source

```ts
  1  | import { isolateBrowserProcess } from './browser-process-fixture';
  2  | import { addSlot, expect, test } from './upstream-runtime-fixture';
  3  | 
  4  | isolateBrowserProcess(import.meta.url);
  5  | 
  6  | test('Q2991 repeatedly destroys real Vue 2 instances and subscriptions without retaining connected Realms', async ({ page }) => {
  7  |   await addSlot(page, 'vue2-cleanup');
  8  |   await page.evaluate(() => {
  9  |     const s = window.__upstreamRuntime__!;
  10 |     s.runtime.events.on('vue2-destroyed', () => { s.calls.destroyed = (s.calls.destroyed ?? 0) + 1; });
  11 |     s.runtime.events.on('vue2-reply', () => { s.calls.replies = (s.calls.replies ?? 0) + 1; });
  12 |   });
  13 |   for (let round = 0; round < 4; round++) {
  14 |     await page.evaluate(async () => {
  15 |       const s = window.__upstreamRuntime__!;
  16 |       s.handles.push(await s.runtime.mountApp({ name: 'vue2-cleanup', container: s.slots[0]!,
  17 |         entry: { type: 'module', url: 'http://127.0.0.1:5179/src/upstream-batch04/cleanup-entry.ts' } }));
  18 |       s.originalFrame = s.slots[0]!.querySelector('iframe')!;
  19 |       s.runtime.events.emit('vue2-probe', {});
  20 |     });
  21 |     await page.getByRole('button', { name: 'Vue2: 0', exact: true }).click();
  22 |     await expect(page.getByRole('button', { name: 'Vue2: 1', exact: true })).toBeVisible();
  23 |     await expect.poll(() => page.evaluate(() => window.__upstreamRuntime__!.calls.replies)).toBe(round + 1);
  24 |     await page.evaluate(() => window.__upstreamRuntime__!.handles.at(-1)!.dispose());
  25 |     await expect(page.locator('#vue2-cleanup iframe, #vue2-cleanup micro-app-host')).toHaveCount(0);
  26 |     expect(await page.evaluate(() => {
  27 |       const s = window.__upstreamRuntime__!; s.runtime.events.emit('vue2-probe', {});
  28 |       return { connected: s.originalFrame!.isConnected, destroyed: s.calls.destroyed, replies: s.calls.replies };
> 29 |     })).toEqual({ connected: false, destroyed: round + 1, replies: round + 1 });
     |         ^ Error: expect(received).toEqual(expected) // deep equality
  30 |   }
  31 | });
  32 | 
  33 | test('W1039 reopens a real host dialog with an alive Vue router after repeated child navigation', async ({ page }) => {
  34 |   await addSlot(page, 'dialog-slot');
  35 |   await page.evaluate(async () => {
  36 |     const s = window.__upstreamRuntime__!;
  37 |     const dialog = document.body.appendChild(document.createElement('dialog'));
  38 |     dialog.dataset.upstreamRuntime = ''; dialog.id = 'alive-dialog';
  39 |     dialog.appendChild(s.slots[0]!); dialog.showModal();
  40 |     s.handles.push(await s.runtime.mountApp({ name: 'dialog-child', container: s.slots[0]!, keepAlive: true,
  41 |       entry: { type: 'module', url: 'http://127.0.0.1:5176/src/upstream-batch03/runtime-entry.ts' }, props: { route: '/home' } }));
  42 |     s.originalFrame = s.slots[0]!.querySelector('iframe')!;
  43 |   });
  44 |   for (let round = 0; round < 3; round++) {
  45 |     await page.getByRole('button', { name: `Vue count: ${round}`, exact: true }).click();
  46 |     await page.getByRole('button', { name: 'Open details', exact: true }).click();
  47 |     await expect(page.locator('[data-route]')).toHaveText('/details');
  48 |     await page.evaluate(async () => {
  49 |       await window.__upstreamRuntime__!.handles[0]!.unmount();
  50 |       (document.querySelector('#alive-dialog') as HTMLDialogElement).close();
  51 |     });
  52 |     await expect(page.locator('#alive-dialog')).not.toBeVisible();
  53 |     await page.evaluate(async () => {
  54 |       (document.querySelector('#alive-dialog') as HTMLDialogElement).showModal();
  55 |       await window.__upstreamRuntime__!.handles[0]!.mount();
  56 |     });
  57 |     await expect(page.getByRole('button', { name: `Vue count: ${round + 1}`, exact: true })).toBeVisible();
  58 |     await page.getByRole('button', { name: 'Child back', exact: true }).click();
  59 |     await expect(page.locator('[data-route]')).toHaveText('/home');
  60 |     expect(await page.evaluate(() => {
  61 |       const s = window.__upstreamRuntime__!;
  62 |       return s.originalFrame === s.slots[0]!.querySelector('iframe') && s.originalFrame!.isConnected;
  63 |     })).toBe(true);
  64 |   }
  65 |   await page.evaluate(() => window.__upstreamRuntime__!.handles[0]!.dispose());
  66 |   await expect(page.locator('#dialog-slot iframe, #dialog-slot micro-app-host')).toHaveCount(0);
  67 | });
  68 | 
```