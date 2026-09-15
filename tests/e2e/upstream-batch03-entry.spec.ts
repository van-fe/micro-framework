import type { MicroRuntime } from '@micro-framework/runtime';
import { test, expect, isolateBrowserProcess } from './browser-process-fixture';

isolateBrowserProcess(import.meta.url);
declare global { interface Window { __batch03EntryRuntime?: MicroRuntime; } }
test.afterEach(async({page})=>{
  await page.evaluate(async()=>{await window.__batch03EntryRuntime?.destroy();delete window.__batch03EntryRuntime;});
});
test('W1049 Q3125 Q2971 loads Vite production routes once with isolated URL imports and clean Runtime destruction',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/benchmark.html');
  await page.waitForFunction(()=>Boolean(window.__createMicroFrameBenchmarkRuntime__));
  const setup=await page.evaluate(async()=>{
    const {origin}=await(await fetch('/__batch03-entry')).json() as {origin:string};
    const before=await(await fetch(origin+'/requests')).json() as string[];
    const runtime=window.__createMicroFrameBenchmarkRuntime__!();window.__batch03EntryRuntime=runtime;
    const container=document.body.appendChild(document.createElement('main'));container.id='batch03-entry';
    await runtime.mountApp({name:'vite-production',container,entry:{type:'html',url:origin+'/vite-count/index.html'}});
    return {origin,before:before.length};
  });
  await expect(page.locator('#batch03-entry output')).toHaveText('Home route');
  await page.getByRole('button',{name:'About',exact:true}).click();
  await expect(page.locator('#batch03-entry output')).toHaveText('About route');
  await page.getByRole('button',{name:'Home',exact:true}).click();
  await expect(page.locator('#batch03-entry output')).toHaveText('Home route');
  const snapshot=await page.evaluate(()=>{
    const frame=document.querySelector<HTMLIFrameElement>('#batch03-entry iframe')!.contentWindow!;
    return {owner:Reflect.get(frame,'batch03Owner')===frame,remote:(Reflect.get(frame,'batch03Remote') as {owner:Window}).owner===frame,home:Reflect.get(frame,'batch03HomeEvaluations'),about:Reflect.get(frame,'batch03AboutEvaluations'),host:Reflect.has(window,'batch03Owner')};
  });
  expect(snapshot).toEqual({owner:true,remote:true,home:1,about:1,host:false});
  const requests=(await page.evaluate(async origin=>(await(await fetch(origin+'/requests')).json()) as Promise<string[]>,setup.origin)).slice(setup.before);
  const scripts=requests.filter(path=>path.startsWith('/vite-count/assets/')&&path.endsWith('.js'));
  for(const path of new Set(scripts))expect(scripts.filter(item=>item===path),path).toHaveLength(1);
  expect(requests.some(path=>/\/vite-count\/assets\/vendor.*\.js/.test(path))).toBe(true);
  await page.evaluate(async()=>{await window.__batch03EntryRuntime!.destroy();});
  await expect(page.locator('#batch03-entry micro-app-host')).toHaveCount(0);
  expect(errors).toEqual([]);
});
