import { isolateBrowserProcess } from './browser-process-fixture';
import { addSlot, expect, test } from './upstream-batch02-runtime-fixture';

isolateBrowserProcess(import.meta.url);

test('Q3036 recovers B at the identical URL after A-offline-B-A-online-B without reloading the host', async ({ page, context, deployment }) => {
  await addSlot(page, 'network-a-slot'); await addSlot(page, 'network-b-slot');
  await page.evaluate(async () => {
    const s = window.__upstreamRuntime__!;
    s.handles.push(await s.runtime.mountApp({ name: 'working-a', container: s.slots[0]!, keepAlive: true,
      entry: { type: 'module', url: new URL('/upstream-runtime-counter.js', location.href).href }, props: { title: 'A' } }));
  });
  await page.locator('#network-a-slot').getByRole('button').click();
  const hostURL = page.url();
  await context.setOffline(true);
  try {
    const error = await page.evaluate(async url => {
      const s = window.__upstreamRuntime__!;
      await s.handles[0]!.unmount();
      try { await s.runtime.mountApp({ name: 'offline-b', container: s.slots[1]!, entry: { type: 'html', url } }); return null; }
      catch (error) { s.expectedErrors = [...s.errors]; return String(error); }
    }, deployment.url);
    expect(error).toContain('All application entries failed');
    await expect(page.locator('#network-b-slot micro-app-host, #network-b-slot iframe')).toHaveCount(0);
    await page.evaluate(() => window.__upstreamRuntime__!.handles[0]!.mount());
    await expect(page.locator('#network-a-slot').getByRole('button')).toHaveText('A: 1');
  } finally { await context.setOffline(false); }
  await page.evaluate(async url => {
    const s = window.__upstreamRuntime__!; await s.handles[0]!.unmount();
    s.handles.push(await s.runtime.mountApp({ name: 'offline-b', container: s.slots[1]!, entry: { type: 'html', url } }));
  }, deployment.url);
  await page.locator('#network-b-slot').getByRole('button').click();
  await expect(page.locator('#network-b-slot').getByRole('button')).toHaveText('Deployment v1: 1');
  expect(deployment.requests).toContain('/index.html'); expect(deployment.requests).toContain('/entry.v1.js');
  expect(page.url()).toBe(hostURL);
});
