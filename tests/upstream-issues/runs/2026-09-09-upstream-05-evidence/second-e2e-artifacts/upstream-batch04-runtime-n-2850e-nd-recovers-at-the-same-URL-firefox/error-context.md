# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: upstream-batch04-runtime-network.spec.ts >> W1057 HTML style timeout closes the pending transport and recovers at the same URL
- Location: tests/e2e/upstream-batch04-runtime-network.spec.ts:6:53

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected value: "/slow.css"
Received array: []

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [active]:
  - main
```

# Test source

```ts
  1  | import { isolateBrowserProcess } from './browser-process-fixture';
  2  | import { addSlot, expect, test } from './upstream-batch04-runtime-network-fixture';
  3  | 
  4  | isolateBrowserProcess(import.meta.url);
  5  | 
  6  | for (const blocked of ['script', 'style'] as const) test(`W1057 HTML ${blocked} timeout closes the pending transport and recovers at the same URL`, async ({ page, slowDeployment }) => {
  7  |   slowDeployment.blocked = blocked;
  8  |   await addSlot(page, 'html-timeout-slot');
  9  |   await page.evaluate(async url => {
  10 |     const s = window.__upstreamRuntime__!; await s.runtime.destroy();
  11 |     s.runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false }, timeouts: { load: 2000 } });
  12 |     s.runtime.errors.subscribe(({ name, phase, error }) => s.errors.push({ name, phase, message: String(error) }));
  13 |     s.operations.push(s.runtime.mountApp({ name: 'slow-html', container: s.slots[0]!,
  14 |       entry: { type: 'html', url, globalName: 'batch04Slow' } }).then(handle => { s.handles.push(handle); }, error => {
  15 |       s.calls.failed = 1; s.calls.timeout = String(error).includes('exceeded') ? 1 : 0; s.expectedErrors = [...s.errors];
  16 |     }));
  17 |   }, slowDeployment.url);
  18 |   const resource = blocked === 'script' ? '/slow.js' : '/slow.css';
  19 |   await expect.poll(() => slowDeployment.requests.includes(resource)).toBe(true);
  20 |   await expect.poll(() => page.evaluate(() => window.__upstreamRuntime__!.calls.failed)).toBe(1);
  21 |   expect(await page.evaluate(() => window.__upstreamRuntime__!.calls.timeout)).toBe(1);
  22 |   await expect(page.locator('#html-timeout-slot iframe, #html-timeout-slot micro-app-host')).toHaveCount(0);
  23 |   // Must precede server recovery/cleanup; ending it ourselves is not cancellation evidence.
> 24 |   await expect.poll(() => slowDeployment.aborted).toContain(resource);
     |                                                   ^ Error: expect(received).toContain(expected) // indexOf
  25 |   slowDeployment.slow = false;
  26 |   await page.evaluate(async url => {
  27 |     const s = window.__upstreamRuntime__!;
  28 |     s.handles.push(await s.runtime.mountApp({ name: 'slow-html', container: s.slots[0]!,
  29 |       entry: { type: 'html', url, globalName: 'batch04Slow' } }));
  30 |   }, slowDeployment.url);
  31 |   const button = page.getByRole('button', { name: 'HTML recovered: 0', exact: true });
  32 |   await expect(button).toHaveCSS('color', 'rgb(12, 34, 56)');
  33 |   await button.click();
  34 |   await expect(page.getByRole('button', { name: 'HTML recovered: 1', exact: true })).toBeVisible();
  35 |   expect(slowDeployment.requests.filter(path => path === resource)).toHaveLength(2);
  36 | });
  37 | 
```