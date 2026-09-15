# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: upstream-batch04-canvas-base.spec.ts >> W1044 resolves relative HTML resources from the child base in a fresh isolated browser context
- Location: tests/e2e/upstream-batch04-canvas-base.spec.ts:27:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: locator('.base-probe')
Expected pattern: /\/batch04-base\/child\/assets\/$/
Received string:  "http://127.0.0.1:5173/__micro_frame__/realm.html"
Timeout: 5000ms

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for locator('.base-probe')
    14 × locator resolved to <p class="base-probe" data-url="http://127.0.0.1:5173/__micro_frame__/realm.html">Base resource</p>
       - unexpected value "http://127.0.0.1:5173/__micro_frame__/realm.html"

```

```yaml
- paragraph: Base resource
```

# Test source

```ts
  1  | import {isolateBrowserProcess} from './browser-process-fixture';
  2  | import {addSlot,expect,test} from './upstream-runtime-fixture';
  3  | 
  4  | isolateBrowserProcess(import.meta.url);
  5  | test('W992 retains painted canvas pixels and native node identity over keepAlive hide and return',async({page})=>{
  6  |   await addSlot(page,'canvas-slot');
  7  |   await page.route('**/batch04-canvas.js',route=>route.fulfill({contentType:'text/javascript',body:`
  8  |     export function mount(props){const c=document.createElement('canvas');c.width=80;c.height=40;
  9  |     const ctx=c.getContext('2d');ctx.fillStyle='rgb(23,45,67)';ctx.fillRect(0,0,80,40);props.container.append(c);}
  10 |     export function unmount(props){props.container.replaceChildren();}
  11 |   `}));
  12 |   await page.evaluate(async()=>{
  13 |     const s=window.__upstreamRuntime__!;
  14 |     s.handles.push(await s.runtime.mountApp({name:'canvas',container:s.slots[0]!,keepAlive:true,entry:{type:'module',url:new URL('/batch04-canvas.js',location.href).href}}));
  15 |     Reflect.set(window,'batch04Canvas',s.slots[0]!.querySelector('micro-app-host')!.shadowRoot!.querySelector('canvas'));
  16 |   });
  17 |   for(let i=0;i<3;i++) {
  18 |     await expect(page.locator('canvas')).toBeVisible();
  19 |     expect(await page.locator('canvas').evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(10,10,1,1).data))).toEqual([23,45,67,255]);
  20 |     await page.evaluate(()=>window.__upstreamRuntime__!.handles[0]!.unmount());
  21 |     await expect(page.locator('canvas')).toBeHidden();
  22 |     await page.evaluate(()=>window.__upstreamRuntime__!.handles[0]!.mount());
  23 |     expect(await page.locator('canvas').evaluate(c=>c===Reflect.get(window,'batch04Canvas'))).toBe(true);
  24 |   }
  25 | });
  26 | 
  27 | test('W1044 resolves relative HTML resources from the child base in a fresh isolated browser context',async({page})=>{
  28 |   await addSlot(page,'base-slot');
  29 |   const requests:string[]=[];
  30 |   await page.route('**/batch04-base/**',route=>{
  31 |     const path=new URL(route.request().url()).pathname;requests.push(path);
  32 |     if(path.endsWith('index.html')) return route.fulfill({contentType:'text/html',body:'<base href="./assets/"><p class="base-probe">Base resource</p><link rel="stylesheet" href="style.css"><script type="module" src="entry.js"></script>'});
  33 |     if(path.endsWith('style.css'))return route.fulfill({contentType:'text/css',body:'.base-probe{color:rgb(12,34,56)}'});
  34 |     if(path.endsWith('entry.js'))return route.fulfill({contentType:'text/javascript',body:'export function mount(){document.querySelector(".base-probe").dataset.url=document.baseURI} export function unmount(){}'});
  35 |     return route.fulfill({status:404,body:'incorrect base'});
  36 |   });
  37 |   await page.evaluate(async()=>{
  38 |     const s=window.__upstreamRuntime__!;
  39 |     history.replaceState({},'', '/host/deep/route?private=1');
  40 |     s.handles.push(await s.runtime.mountApp({name:'base',container:s.slots[0]!,entry:{type:'html',url:new URL('/batch04-base/child/index.html',location.origin).href}}));
  41 |   });
  42 |   await expect(page.locator('.base-probe')).toHaveCSS('color','rgb(12, 34, 56)');
> 43 |   await expect(page.locator('.base-probe')).toHaveAttribute('data-url',/\/batch04-base\/child\/assets\/$/);
     |                                             ^ Error: expect(locator).toHaveAttribute(expected) failed
  44 |   expect(requests).toContain('/batch04-base/child/assets/entry.js');
  45 |   expect(requests).toContain('/batch04-base/child/assets/style.css');
  46 |   expect(requests.every(path=>path.startsWith('/batch04-base/child/'))).toBe(true);
  47 | });
  48 | 
```