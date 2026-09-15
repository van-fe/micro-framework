# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: upstream-batch04-routing.spec.ts >> Q2976 W1007 W1045 keeps an explicit child route through repeated reloads and subsequent navigation without recursive encoding
- Location: tests/e2e/upstream-batch04-routing.spec.ts:50:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goBack: Test timeout of 30000ms exceeded.
Call log:
  - waiting for navigation until "load"

```

# Page snapshot

```yaml
- generic [active] [ref=f6e1]:
  - button "Host details" [ref=f6e2]
  - button "Host third" [ref=f6e3]
```

# Test source

```ts
  1  | import { expect, isolateBrowserProcess, test } from './browser-process-fixture';
  2  | 
  3  | isolateBrowserProcess(import.meta.url);
  4  | // The host owns the URL; explicit props forward the child route on boot and popstate.
  5  | // This tests this project's documented integration, not an implicit query sync adapter.
  6  | const hostScript = `
  7  | import '/src/benchmark.ts';
  8  | const runtime = window.__createMicroFrameBenchmarkRuntime__({routing:{mode:'history'},storage:{persistent:false}});
  9  | window.batch04Runtime = runtime;
  10 | window.batch04Errors = [];
  11 | runtime.errors.subscribe(e => window.batch04Errors.push(String(e.error)));
  12 | const route = () => new URL(location.href).searchParams.get('child') || '/home';
  13 | const handle = await runtime.mountApp({name:'persisted-route',container:'#slot',entry:{type:'module',url:'http://127.0.0.1:5176/src/upstream-batch04/router-entry.ts'},props:{route:route(),redirectOnMount:location.search.includes('redirect=1')}});
  14 | window.batch04Handle = handle;
  15 | const navigate = async path => {
  16 |  const url=new URL(location.href);url.searchParams.set('child',path);history.pushState({},'',url);
  17 |  await handle.update({route:path});
  18 | };
  19 | document.querySelector('#host-details').onclick=()=>navigate('/details?filter=open');
  20 | document.querySelector('#host-third').onclick=()=>navigate('/third');
  21 | window.addEventListener('popstate',()=>handle.update({route:route()}));
  22 | document.body.dataset.ready='true';
  23 | `;
  24 | 
  25 | async function boot(page: import('@playwright/test').Page, suffix = '') {
  26 |   await page.route('**/batch04-host.js', r => r.fulfill({contentType:'text/javascript',body:hostScript}));
  27 |   await page.route('**/batch04-host.html*', r => r.fulfill({contentType:'text/html',body:'<!doctype html><button id="host-details">Host details</button><button id="host-third">Host third</button><div id="slot"></div><script type="module" src="/batch04-host.js"></script>'}));
  28 |   await page.goto('/batch04-host.html?child=%2Fschedule%2Flist'+suffix);
  29 |   await expect(page.locator('body')).toHaveAttribute('data-ready','true');
  30 | }
  31 | 
  32 | test.afterEach(async ({page}) => {
  33 |   const result = await page.evaluate(async () => {
  34 |     const runtime = Reflect.get(window,'batch04Runtime');
  35 |     await runtime?.destroy();
  36 |     return {errors:Reflect.get(window,'batch04Errors') ?? [],remaining:document.querySelectorAll('micro-app-host,iframe').length};
  37 |   });
  38 |   expect(result).toEqual({errors:[],remaining:0});
  39 | });
  40 | 
  41 | test('Q2990 performs Vue hash router push in mounted under a history host without changing its URL', async ({page}) => {
  42 |   await boot(page,'&redirect=1');
  43 |   const url=page.url();
  44 |   await expect(page.locator('[data-batch04-route]')).toHaveText('/mounted-target?from=hook');
  45 |   await page.getByRole('button',{name:'Child details',exact:true}).click();
  46 |   await expect(page.locator('[data-batch04-route]')).toHaveText('/details');
  47 |   expect(page.url()).toBe(url);
  48 | });
  49 | 
  50 | test('Q2976 W1007 W1045 keeps an explicit child route through repeated reloads and subsequent navigation without recursive encoding', async ({page}) => {
  51 |   await boot(page);
  52 |   await expect(page.locator('[data-batch04-route]')).toHaveText('/schedule/list');
  53 |   await page.getByRole('button',{name:'Host details',exact:true}).click();
  54 |   await expect(page.locator('[data-batch04-route]')).toHaveText('/details?filter=open');
  55 |   const expectedURL=page.url();
  56 |   for(let i=0;i<3;i++) {
  57 |     await page.reload();
  58 |     await expect(page.locator('body')).toHaveAttribute('data-ready','true');
  59 |     await expect(page.locator('[data-batch04-route]')).toHaveText('/details?filter=open');
  60 |     expect(page.url()).toBe(expectedURL);
  61 |     await expect(page.locator('micro-app-host')).toHaveCount(1);
  62 |     await expect(page.locator('micro-app-host')).toHaveAttribute('data-micro-app','persisted-route');
  63 |   }
  64 |   await page.getByRole('button',{name:'Host third',exact:true}).click();
  65 |   await expect(page.locator('[data-batch04-route]')).toHaveText('/third');
> 66 |   await page.goBack();
     |              ^ Error: page.goBack: Test timeout of 30000ms exceeded.
  67 |   await expect(page.locator('[data-batch04-route]')).toHaveText('/details?filter=open');
  68 |   expect(page.url()).toBe(expectedURL);
  69 | });
  70 | 
```