import { isolateBrowserProcess } from './browser-process-fixture';
import { addSlot, expect, test } from './upstream-runtime-fixture';

isolateBrowserProcess(import.meta.url);

test('Q3018 preserves module initialized adjacent styles across keepAlive hide return and disposal recreation', async ({ page }) => {
  await addSlot(page, 'adjacent-style-slot');
  await addSlot(page, 'adjacent-style-sibling');
  await page.route('**/batch04-adjacent-styles.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: `
      const first = document.createElement('style');
      first.dataset.batch04Style = 'first';
      first.textContent = '.batch04-style-first { color: rgb(11,22,33) }';
      document.head.appendChild(first);
      const second = document.createElement('style');
      second.dataset.batch04Style = 'second';
      second.textContent = '.batch04-style-second { color: rgb(44,55,66); width: 84px }';
      first.insertAdjacentElement('afterend', second);
      window.__batch04Styles = {first, second, identity: window};
      export function mount(props) {
        props.container.innerHTML = '<p class="batch04-style-first">First style</p><button class="batch04-style-second">Style count: 0</button>';
        const button = props.container.querySelector('button'); let count = 0;
        button.onclick = () => { button.textContent = 'Style count: ' + ++count; };
      }
      export function unmount(props) { props.container.replaceChildren(); }
    `,
  }));
  await page.evaluate(async () => {
    const s = window.__upstreamRuntime__!;
    const host = document.body.appendChild(document.createElement('p'));
    host.className = 'batch04-style-second'; host.dataset.upstreamRuntime = ''; host.id = 'style-host-control'; host.textContent = 'Host';
    Reflect.set(window, '__batch04HostColor', getComputedStyle(host).color);
    s.handles.push(await s.runtime.mountApp({name: 'style-sibling', container: s.slots[1]!, entry: {type: 'module', url: new URL('/upstream-runtime-counter.js', location.href).href}, props: {title: 'Sibling'}}));
    const sibling = s.slots[1]!.querySelector('micro-app-host')!.shadowRoot!.querySelector('button')!;
    sibling.className = 'batch04-style-second';
    Reflect.set(window, '__batch04SiblingColor', getComputedStyle(sibling).color);
  });
  for (let generation = 0; generation < 2; generation++) {
    await page.evaluate(async () => {
      const s = window.__upstreamRuntime__!;
      s.handles[1] = await s.runtime.mountApp({name: 'adjacent-styles', container: s.slots[0]!, keepAlive: true, entry: {type: 'module', url: new URL('/batch04-adjacent-styles.js', location.href).href}});
      const frame = s.slots[0]!.querySelector('iframe')!.contentWindow!;
      Reflect.set(window, '__batch04SavedStyles', Reflect.get(frame, '__batch04Styles'));
    });
    for (let cycle = 0; cycle < 3; cycle++) {
      await expect(page.locator('#adjacent-style-slot .batch04-style-first')).toHaveCSS('color', 'rgb(11, 22, 33)');
      await expect(page.locator('#adjacent-style-slot .batch04-style-second')).toHaveCSS('color', 'rgb(44, 55, 66)');
      await expect(page.locator('#adjacent-style-slot .batch04-style-second')).toHaveCSS('width', '84px');
      await page.locator('#adjacent-style-slot button').click();
      await expect(page.locator('#adjacent-style-slot button')).toHaveText(`Style count: ${cycle + 1}`);
      await page.evaluate(() => window.__upstreamRuntime__!.handles[1]!.unmount());
      await expect(page.locator('#adjacent-style-slot button')).toBeHidden();
      await page.evaluate(() => window.__upstreamRuntime__!.handles[1]!.mount());
      expect(await page.evaluate(() => {
        const frame = window.__upstreamRuntime__!.slots[0]!.querySelector('iframe')!.contentWindow!;
        const saved = Reflect.get(window, '__batch04SavedStyles');
        const current = Reflect.get(frame, '__batch04Styles');
        return saved === current && saved.identity === frame && saved.first.nextElementSibling === saved.second && saved.second.isConnected;
      })).toBe(true);
      expect(await page.locator('#style-host-control').evaluate(node => getComputedStyle(node).color === Reflect.get(window, '__batch04HostColor'))).toBe(true);
      expect(await page.locator('#adjacent-style-sibling button').evaluate(node => getComputedStyle(node).color === Reflect.get(window, '__batch04SiblingColor'))).toBe(true);
    }
    await page.evaluate(() => window.__upstreamRuntime__!.handles[1]!.dispose());
    expect(await page.evaluate(() => {
      const saved = Reflect.get(window, '__batch04SavedStyles');
      return !saved.first.isConnected && !saved.second.isConnected;
    })).toBe(true);
    await expect(page.locator('#adjacent-style-slot iframe')).toHaveCount(0);
    await expect(page.locator('#adjacent-style-slot button')).toHaveCount(0);
  }
});
