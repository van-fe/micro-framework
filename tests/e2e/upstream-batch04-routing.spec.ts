import { expect, isolateBrowserProcess, test } from './browser-process-fixture';

isolateBrowserProcess(import.meta.url);
// The host owns the URL; explicit props forward the child route on boot and popstate.
// This tests this project's documented integration, not an implicit query sync adapter.
const hostScript = `
import '/src/benchmark.ts';
const runtime = window.__createMicroFrameBenchmarkRuntime__({routing:{mode:'history'},storage:{persistent:false}});
window.batch04Runtime = runtime;
window.batch04Errors = [];
runtime.errors.subscribe(e => window.batch04Errors.push(String(e.error)));
const route = () => new URL(location.href).searchParams.get('child') || '/home';
const handle = await runtime.mountApp({name:'persisted-route',container:'#slot',entry:{type:'module',url:'http://127.0.0.1:5176/src/upstream-batch04/router-entry.ts'},props:{route:route(),redirectOnMount:location.search.includes('redirect=1')}});
window.batch04Handle = handle;
const navigate = async path => {
 const url=new URL(location.href);url.searchParams.set('child',path);history.pushState({},'',url);
 await handle.update({route:path});
};
document.querySelector('#host-details').onclick=()=>navigate('/details?filter=open');
document.querySelector('#host-third').onclick=()=>navigate('/third');
window.addEventListener('popstate',()=>handle.update({route:route()}));
document.body.dataset.ready='true';
`;

async function boot(page: import('@playwright/test').Page, suffix = '') {
  await page.route('**/batch04-host.js', r => r.fulfill({contentType:'text/javascript',body:hostScript}));
  await page.route('**/batch04-host.html*', r => r.fulfill({contentType:'text/html',body:'<!doctype html><button id="host-details">Host details</button><button id="host-third">Host third</button><div id="slot"></div><script type="module" src="/batch04-host.js"></script>'}));
  await page.goto('/batch04-host.html?child=%2Fschedule%2Flist'+suffix);
  await expect(page.locator('body')).toHaveAttribute('data-ready','true');
}

test.afterEach(async ({page}) => {
  const result = await page.evaluate(async () => {
    const runtime = Reflect.get(window,'batch04Runtime');
    await runtime?.destroy();
    return {errors:Reflect.get(window,'batch04Errors') ?? [],remaining:document.querySelectorAll('micro-app-host,iframe').length};
  });
  expect(result).toEqual({errors:[],remaining:0});
});

test('Q2990 performs Vue hash router push in mounted under a history host without changing its URL', async ({page}) => {
  await boot(page,'&redirect=1');
  const url=page.url();
  await expect(page.locator('[data-batch04-route]')).toHaveText('/mounted-target?from=hook');
  await page.getByRole('button',{name:'Child details',exact:true}).click();
  await expect(page.locator('[data-batch04-route]')).toHaveText('/details');
  expect(page.url()).toBe(url);
});

test('Q2976 W1007 W1045 keeps an explicit child route through repeated reloads and subsequent navigation without recursive encoding', async ({page}) => {
  await boot(page);
  await expect(page.locator('[data-batch04-route]')).toHaveText('/schedule/list');
  await page.getByRole('button',{name:'Host details',exact:true}).click();
  await expect(page.locator('[data-batch04-route]')).toHaveText('/details?filter=open');
  const expectedURL=page.url();
  for(let i=0;i<3;i++) {
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-ready','true');
    await expect(page.locator('[data-batch04-route]')).toHaveText('/details?filter=open');
    expect(page.url()).toBe(expectedURL);
    await expect(page.locator('micro-app-host')).toHaveCount(1);
    await expect(page.locator('micro-app-host')).toHaveAttribute('data-micro-app','persisted-route');
  }
  await page.getByRole('button',{name:'Host third',exact:true}).click();
  await expect(page.locator('[data-batch04-route]')).toHaveText('/third');
  await page.goBack();
  await expect(page.locator('[data-batch04-route]')).toHaveText('/details?filter=open');
  expect(page.url()).toBe(expectedURL);
});
