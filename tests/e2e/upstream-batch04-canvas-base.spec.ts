import {isolateBrowserProcess} from './browser-process-fixture';
import {addSlot,expect,test} from './upstream-runtime-fixture';

isolateBrowserProcess(import.meta.url);
test('W992 retains painted canvas pixels and native node identity over keepAlive hide and return',async({page})=>{
  await addSlot(page,'canvas-slot');
  await page.route('**/batch04-canvas.js',route=>route.fulfill({contentType:'text/javascript',body:`
    export function mount(props){const c=document.createElement('canvas');c.width=80;c.height=40;
    const ctx=c.getContext('2d');ctx.fillStyle='rgb(23,45,67)';ctx.fillRect(0,0,80,40);props.container.append(c);}
    export function unmount(props){props.container.replaceChildren();}
  `}));
  await page.evaluate(async()=>{
    const s=window.__upstreamRuntime__!;
    s.handles.push(await s.runtime.mountApp({name:'canvas',container:s.slots[0]!,keepAlive:true,entry:{type:'module',url:new URL('/batch04-canvas.js',location.href).href}}));
    Reflect.set(window,'batch04Canvas',s.slots[0]!.querySelector('micro-app-host')!.shadowRoot!.querySelector('canvas'));
  });
  for(let i=0;i<3;i++) {
    await expect(page.locator('canvas')).toBeVisible();
    expect(await page.locator('canvas').evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(10,10,1,1).data))).toEqual([23,45,67,255]);
    await page.evaluate(()=>window.__upstreamRuntime__!.handles[0]!.unmount());
    await expect(page.locator('canvas')).toBeHidden();
    await page.evaluate(()=>window.__upstreamRuntime__!.handles[0]!.mount());
    expect(await page.locator('canvas').evaluate(c=>c===Reflect.get(window,'batch04Canvas'))).toBe(true);
  }
});

test('W1044 resolves relative HTML resources from the child base in a fresh isolated browser context',async({page})=>{
  await addSlot(page,'base-slot');
  const requests:string[]=[];
  await page.route('**/batch04-base/**',route=>{
    const path=new URL(route.request().url()).pathname;requests.push(path);
    if(path.endsWith('index.html')) return route.fulfill({contentType:'text/html',body:'<base href="./assets/"><p class="base-probe">Base resource</p><link rel="stylesheet" href="style.css"><script type="module" src="entry.js"></script>'});
    if(path.endsWith('style.css'))return route.fulfill({contentType:'text/css',body:'.base-probe{color:rgb(12,34,56)}'});
    if(path.endsWith('entry.js'))return route.fulfill({contentType:'text/javascript',body:'export function mount(){document.querySelector(".base-probe").dataset.url=document.baseURI} export function unmount(){}'});
    return route.fulfill({status:404,body:'incorrect base'});
  });
  await page.evaluate(async()=>{
    const s=window.__upstreamRuntime__!;
    history.replaceState({},'', '/host/deep/route?private=1');
    s.handles.push(await s.runtime.mountApp({name:'base',container:s.slots[0]!,entry:{type:'html',url:new URL('/batch04-base/child/index.html',location.origin).href}}));
  });
  await expect(page.locator('.base-probe')).toHaveCSS('color','rgb(12, 34, 56)');
  await expect(page.locator('.base-probe')).toHaveAttribute('data-url',/\/batch04-base\/child\/assets\/$/);
  expect(requests).toContain('/batch04-base/child/assets/entry.js');
  expect(requests).toContain('/batch04-base/child/assets/style.css');
  expect(requests.every(path=>path.startsWith('/batch04-base/child/'))).toBe(true);
});
