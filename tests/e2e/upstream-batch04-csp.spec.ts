import { test, expect, isolateBrowserProcess } from './browser-process-fixture';

isolateBrowserProcess(import.meta.url);

test('Q3129 mounts external modules without unsafe inline scripts or eval under same origin CSP', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Reflect.set(window, '__batch04Violations', []);
    document.addEventListener('securitypolicyviolation', event => {
      Reflect.get(window, '__batch04Violations').push({directive: event.effectiveDirective, blocked: event.blockedURI});
    });
  });
  await page.route('**/batch04-csp-host.html', route => route.fulfill({
    contentType: 'text/html',
    headers: {'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ws:;"},
    body: '<!doctype html><html><head><title>External module CSP</title></head><body><main id="csp-slot"></main><script type="module" src="/src/benchmark.ts"></script></body></html>',
  }));
  await page.route('**/batch04-csp-entry.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: `export function mount(props) {
      const button = document.createElement('button'); let count = 0;
      button.textContent = 'External CSP: 0';
      button.onclick = () => { button.textContent = 'External CSP: ' + ++count; };
      props.container.append(button);
      window.__batch04EntryRealm = window !== parent;
      document.addEventListener('securitypolicyviolation', event => parent.__batch04Violations.push({directive:event.effectiveDirective,blocked:event.blockedURI}));
    }
    export function unmount(props) { props.container.replaceChildren(); }`,
  }));
  await page.goto('/batch04-csp-host.html');
  await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
  await page.evaluate(async () => {
    const runtime = window.__createMicroFrameBenchmarkRuntime__!();
    Reflect.set(window, '__batch04CspRuntime', runtime);
    await runtime.mountApp({ name: 'batch04-csp', container: '#csp-slot', entry: {type: 'module', url: new URL('/batch04-csp-entry.js', location.href).href} });
  });
  await page.getByRole('button', {name: 'External CSP: 0'}).click();
  await expect(page.getByRole('button', {name: 'External CSP: 1'})).toBeVisible();
  expect(await page.locator('#csp-slot iframe').evaluate(frame => Reflect.get((frame as HTMLIFrameElement).contentWindow!, '__batch04EntryRealm'))).toBe(true);
  expect(await page.evaluate(() => Reflect.get(window, '__batch04Violations'))).toEqual([]);
  await page.evaluate(async () => { await Reflect.get(window, '__batch04CspRuntime').destroy(); });
  await expect(page.locator('#csp-slot iframe')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'External CSP: 1'})).toHaveCount(0);
  expect(errors).toEqual([]);
});
