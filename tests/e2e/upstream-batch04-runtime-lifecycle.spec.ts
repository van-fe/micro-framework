import { isolateBrowserProcess } from './browser-process-fixture';
import { addSlot, expect, test } from './upstream-runtime-fixture';

isolateBrowserProcess(import.meta.url);

test('Q2991 repeatedly destroys real Vue 2 instances and subscriptions without retaining connected Realms', async ({ page }) => {
  await addSlot(page, 'vue2-cleanup');
  await page.evaluate(() => {
    const s = window.__upstreamRuntime__!;
    s.runtime.registerService('vue2Destroyed', () => { s.calls.destroyed = (s.calls.destroyed ?? 0) + 1; });
    s.runtime.events.on('vue2-reply', () => { s.calls.replies = (s.calls.replies ?? 0) + 1; });
  });
  for (let round = 0; round < 4; round++) {
    await page.evaluate(async () => {
      const s = window.__upstreamRuntime__!;
      s.handles.push(await s.runtime.mountApp({ name: 'vue2-cleanup', container: s.slots[0]!,
        entry: { type: 'module', url: 'http://127.0.0.1:5179/src/upstream-batch04/cleanup-entry.ts' } }));
      s.originalFrame = s.slots[0]!.querySelector('iframe')!;
      s.runtime.events.emit('vue2-probe', {});
    });
    await page.getByRole('button', { name: 'Vue2: 0', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Vue2: 1', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__upstreamRuntime__!.calls.replies)).toBe(round + 1);
    await page.evaluate(() => window.__upstreamRuntime__!.handles.at(-1)!.dispose());
    await expect(page.locator('#vue2-cleanup iframe, #vue2-cleanup micro-app-host')).toHaveCount(0);
    expect(await page.evaluate(() => {
      const s = window.__upstreamRuntime__!; s.runtime.events.emit('vue2-probe', {});
      return { connected: s.originalFrame!.isConnected, destroyed: s.calls.destroyed, replies: s.calls.replies };
    })).toEqual({ connected: false, destroyed: round + 1, replies: round + 1 });
  }
});

test('W1039 reopens a real host dialog with an alive Vue router after repeated child navigation', async ({ page }) => {
  await addSlot(page, 'dialog-slot');
  await page.evaluate(async () => {
    const s = window.__upstreamRuntime__!;
    const dialog = document.body.appendChild(document.createElement('dialog'));
    dialog.dataset.upstreamRuntime = ''; dialog.id = 'alive-dialog';
    dialog.appendChild(s.slots[0]!); dialog.showModal();
    s.handles.push(await s.runtime.mountApp({ name: 'dialog-child', container: s.slots[0]!, keepAlive: true,
      entry: { type: 'module', url: 'http://127.0.0.1:5176/src/upstream-batch03/runtime-entry.ts' }, props: { route: '/home' } }));
    s.originalFrame = s.slots[0]!.querySelector('iframe')!;
  });
  for (let round = 0; round < 3; round++) {
    await page.getByRole('button', { name: `Vue count: ${round}`, exact: true }).click();
    await page.getByRole('button', { name: 'Open details', exact: true }).click();
    await expect(page.locator('[data-route]')).toHaveText('/details');
    await page.evaluate(async () => {
      await window.__upstreamRuntime__!.handles[0]!.unmount();
      (document.querySelector('#alive-dialog') as HTMLDialogElement).close();
    });
    await expect(page.locator('#alive-dialog')).not.toBeVisible();
    await page.evaluate(async () => {
      (document.querySelector('#alive-dialog') as HTMLDialogElement).showModal();
      await window.__upstreamRuntime__!.handles[0]!.mount();
    });
    await expect(page.getByRole('button', { name: `Vue count: ${round + 1}`, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Child back', exact: true }).click();
    await expect(page.locator('[data-route]')).toHaveText('/home');
    expect(await page.evaluate(() => {
      const s = window.__upstreamRuntime__!;
      return s.originalFrame === s.slots[0]!.querySelector('iframe') && s.originalFrame!.isConnected;
    })).toBe(true);
  }
  await page.evaluate(() => window.__upstreamRuntime__!.handles[0]!.dispose());
  await expect(page.locator('#dialog-slot iframe, #dialog-slot micro-app-host')).toHaveCount(0);
});
