import { isolateBrowserProcess } from './browser-process-fixture';
import { addSlot, expect, test } from './upstream-runtime-fixture';

isolateBrowserProcess(import.meta.url);

test('W991 preserves root CSS variables from preload and pre-execution through alive activation', async ({ page }) => {
  await addSlot(page, 'prewarm-slot');
  await page.route('**/batch03-prewarm.html', route => route.fulfill({ contentType: 'text/html', body: `
    <style>:root { --notice-background: rgb(25, 89, 133); --notice-border: rgb(162, 51, 24); }
      .notice { background-color: var(--notice-background); border: 3px solid var(--notice-border); }</style>
    <div id="prewarm-root"></div><script type="module" src="/batch03-prewarm.js"></script>
  ` }));
  await page.route('**/batch03-prewarm.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    let count = 0;
    export function bootstrap(props) {
      const rule = document.createElement('style'); rule.textContent = ':root { --notice-padding: 17px; } .notice { padding: var(--notice-padding); }';
      document.head.appendChild(rule);
    }
    export function mount(props) {
      const button = document.createElement('button'); button.className = 'notice';
      const render = () => button.textContent = 'Notice ' + count;
      button.onclick = () => { count++; render(); }; render(); props.container.appendChild(button);
    }
    export function unmount(props) { props.container.replaceChildren(); }
  ` }));
  await page.evaluate(async () => {
    const s = window.__upstreamRuntime__!;
    const registration = { name: 'prewarm-css', container: s.slots[0]!, keepAlive: true,
      entry: { type: 'html' as const, url: new URL('/batch03-prewarm.html', location.href).href } };
    await s.runtime.preloadApps([registration]);
    s.handles.push(await s.runtime.prewarmApp(registration));
    s.originalFrame = s.slots[0]!.querySelector('iframe')!;
  });
  await expect(page.locator('#prewarm-slot micro-app-host')).toBeHidden();
  await page.evaluate(() => window.__upstreamRuntime__!.handles[0]!.mount());
  const button = page.locator('#prewarm-slot').getByRole('button');
  for (let cycle = 0; cycle < 2; cycle++) {
    await expect(button).toHaveCSS('background-color', 'rgb(25, 89, 133)');
    await expect(button).toHaveCSS('border-top-color', 'rgb(162, 51, 24)');
    await expect(button).toHaveCSS('padding-left', '17px');
    await button.click(); await expect(button).toHaveText(`Notice ${cycle + 1}`);
    await page.evaluate(async () => { const h = window.__upstreamRuntime__!.handles[0]!; await h.unmount(); });
    await expect(page.locator('#prewarm-slot micro-app-host')).toBeHidden();
    await page.evaluate(() => window.__upstreamRuntime__!.handles[0]!.mount());
  }
  expect(await page.evaluate(() => {
    const s = window.__upstreamRuntime__!;
    return { sameFrame: s.slots[0]!.querySelector('iframe') === s.originalFrame,
      hostToken: getComputedStyle(document.documentElement).getPropertyValue('--notice-background'),
      hostVisibleNodes: document.querySelectorAll('.notice').length };
  })).toEqual({ sameFrame: true, hostToken: '', hostVisibleNodes: 0 });
});

test('W1033 sends a notification through an explicit host service while the prewarmed application remains hidden', async ({ page }) => {
  await addSlot(page, 'prewarm-notice-slot'); await addSlot(page, 'host-notice-slot');
  await page.route('**/batch03-host-notice.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    export async function bootstrap(props) {
      const style = document.createElement('style'); style.textContent = ':root { --private-notice: magenta; }'; document.head.appendChild(style);
      const hidden = document.createElement('p'); hidden.textContent = 'Private child notice'; props.container.appendChild(hidden);
      await props.$runtime.services.call('notifyHost', '$call', { message: 'Background app ready' });
    }
    export function mount() {}
    export function unmount(props) { props.container.replaceChildren(); }
  ` }));
  await page.evaluate(async () => {
    const s = window.__upstreamRuntime__!;
    s.runtime.registerService('notifyHost', ({ message }: { message: string }) => {
      const notice = document.createElement('button'); notice.textContent = message;
      notice.style.cssText = 'background:rgb(21, 92, 46);color:white;padding:12px';
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); icon.setAttribute('width', '16'); icon.setAttribute('height', '16');
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); circle.setAttribute('cx', '8'); circle.setAttribute('cy', '8'); circle.setAttribute('r', '6'); circle.setAttribute('fill', 'currentColor'); icon.appendChild(circle); notice.appendChild(icon);
      notice.onclick = () => { s.calls.dismissed = (s.calls.dismissed ?? 0) + 1; notice.remove(); }; s.slots[1]!.appendChild(notice);
    });
    s.handles.push(await s.runtime.prewarmApp({ name: 'background-notifier', keepAlive: true, container: s.slots[0]!,
      entry: { type: 'module', url: new URL('/batch03-host-notice.js', location.href).href } }));
  });
  await expect(page.locator('#prewarm-notice-slot micro-app-host')).toBeHidden();
  const notice = page.locator('#host-notice-slot').getByRole('button');
  await expect(notice).toHaveText('Background app ready');
  await expect(notice).toHaveCSS('background-color', 'rgb(21, 92, 46)');
  expect(await notice.locator('svg circle').evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(0);
  await notice.click(); await expect(notice).toHaveCount(0);
  expect(await page.evaluate(() => ({ dismissed: window.__upstreamRuntime__!.calls.dismissed,
    privateToken: getComputedStyle(document.documentElement).getPropertyValue('--private-notice') }))).toEqual({ dismissed: 1, privateToken: '' });
});
