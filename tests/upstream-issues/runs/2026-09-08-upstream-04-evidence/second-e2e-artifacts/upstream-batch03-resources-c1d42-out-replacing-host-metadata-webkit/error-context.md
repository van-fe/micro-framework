# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: upstream-batch03-resources.spec.ts >> Q2982 keeps explicit favicon and manifest paths in application subdirectory without replacing host metadata
- Location: tests/e2e/upstream-batch03-resources.spec.ts:55:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.getAttribute: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#resource-slot link[rel="icon"]')

```

# Page snapshot

```yaml
- generic [active]:
  - main
```

# Test source

```ts
  1  | import { test, expect, addSlot } from "./upstream-batch03-resources-fixture";
  2  | import { isolateBrowserProcess } from "./browser-process-fixture";
  3  | 
  4  | isolateBrowserProcess(import.meta.url);
  5  | 
  6  | for (const registered of [false, true]) test(`Q3090 applies declarative include credentials to entry and dynamic script (registered=${registered})`, async ({page,resourceOrigin})=>{
  7  |   await page.context().addCookies([{name:"batch03",value:"credential",url:resourceOrigin.url,sameSite:"Lax"}]);
  8  |   await addSlot(page,"resource-slot");
  9  |   await page.evaluate(async ({url,registered})=>{
  10 |     const s=window.__upstreamRuntime__!;
  11 |     const app={name:"resource-app",container:"#resource-slot",activeWhen:()=>true,entry:{type:"html" as const,url:url+"/app/entry.html",credentials:"include" as const}};
  12 |     if(registered){s.runtime.registerApps([app]);await s.runtime.start({preload:false});}
  13 |     else s.handles.push(await s.runtime.mountApp(app));
  14 |   },{url:resourceOrigin.url,registered});
  15 |   await expect(page.getByRole("button",{name:"Request child API"})).toBeVisible();
  16 |   const requests=resourceOrigin.requests.filter(r=>r.path.endsWith("entry.html")||r.path.endsWith("dynamic.js"));
  17 |   expect(requests.map(r=>r.path)).toEqual(["/app/entry.html","/app/dynamic.js"]);
  18 |   expect(requests.every(r=>r.cookie.includes("batch03=credential"))).toBe(true);
  19 |   expect(await page.evaluate(()=>Reflect.has(window,"resourceExecuted"))).toBe(false);
  20 | });
  21 | 
  22 | test("Q3035 W1005 resolve static and dynamic image and SVG href before requests with host same-name decoys", async ({page,resourceOrigin})=>{
  23 |   const wrong:string[]=[];
  24 |   await page.route('http://127.0.0.1:5173/**/same.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="41" height="43"/>'}));
  25 |   page.on("request",request=>{if(request.url().includes("same.svg")&&!request.url().startsWith(resourceOrigin.url)) wrong.push(request.url());});
  26 |   await addSlot(page,"resource-slot");
  27 |   await page.evaluate(async url=>{const s=window.__upstreamRuntime__!;s.handles.push(await s.runtime.mountApp({name:"images",container:"#resource-slot",entry:{type:"html",url:url+"/app/entry.html"}}));},resourceOrigin.url);
  28 |   await expect.poll(()=>page.locator("#resource-slot img").evaluateAll(nodes=>nodes.map(n=>(n as HTMLImageElement).naturalWidth))).toEqual([13,13]);
  29 |   for(const id of ["static-svg","dynamic-svg"]){
  30 |     expect(await page.locator('#'+id).evaluate(n=>n.getAttribute('href')||n.getAttributeNS('http://www.w3.org/1999/xlink','href'))).toBe(resourceOrigin.url+"/app/same.svg");
  31 |     expect(await page.locator('#'+id).evaluate(n=>(n as SVGGraphicsElement).getBBox().width)).toBe(26);
  32 |   }
  33 |   expect(wrong).toEqual([]);
  34 |   expect(resourceOrigin.requests.some(r=>r.path==="/app/same.svg")).toBe(true);
  35 | });
  36 | 
  37 | test("Q3056 W995 keep explicit child API origin and host Axios baseURL during Vue Router guards",async({page,resourceOrigin})=>{
  38 |   await addSlot(page,"resource-slot");
  39 |   await page.evaluate(async url=>{
  40 |     const moduleURL="http://127.0.0.1:5176/src/upstream-batch03-host-requests.ts";
  41 |     const module=await import(/* @vite-ignore */ moduleURL);
  42 |     Reflect.set(window,"batch03HostRequests",module.createRequests(url));
  43 |   },resourceOrigin.url);
  44 |   for(let cycle=0;cycle<2;cycle++){
  45 |     await page.evaluate(async url=>{const s=window.__upstreamRuntime__!;s.handles.push(await s.runtime.mountApp({name:"api-child",container:"#resource-slot",entry:{type:"html",url:url+"/app/entry.html"}}));},resourceOrigin.url);
  46 |     const button=page.getByRole("button",{name:"Request child API"}); await button.click();await expect(button).toHaveAttribute("data-result",new URL(resourceOrigin.url).host);
  47 |     const result=await page.evaluate(async cycle=>(Reflect.get(window,"batch03HostRequests") as {navigate(path:string):Promise<unknown>}).navigate('/host-'+cycle),cycle);
  48 |     expect(result).toEqual({origin:new URL(resourceOrigin.url).host,path:"/host-api/api/data"});
  49 |     await page.evaluate(async()=>{await window.__upstreamRuntime__!.handles.at(-1)!.dispose();});
  50 |   }
  51 |   expect(resourceOrigin.requests.filter(r=>r.path==="/host-api/api/data")).toHaveLength(2);
  52 |   expect(resourceOrigin.requests.filter(r=>r.path==="/app/api/data")).toHaveLength(2);
  53 | });
  54 | 
  55 | test("Q2982 keeps explicit favicon and manifest paths in application subdirectory without replacing host metadata",async({page,resourceOrigin})=>{
  56 |   const before=await page.locator('head link[rel="icon"],head link[rel="manifest"]').evaluateAll(nodes=>nodes.map(n=>n.outerHTML));
  57 |   await addSlot(page,"resource-slot");
  58 |   await page.evaluate(async url=>{const s=window.__upstreamRuntime__!;s.handles.push(await s.runtime.mountApp({name:"metadata",container:"#resource-slot",entry:{type:"html",url:url+"/app/entry.html"}}));},resourceOrigin.url);
> 59 |   expect(await page.locator('#resource-slot link[rel="icon"]').getAttribute('href')).toBe(resourceOrigin.url+"/app/favicon.svg");
     |                                                                ^ Error: locator.getAttribute: Test timeout of 30000ms exceeded.
  60 |   expect(await page.locator('#resource-slot link[rel="manifest"]').getAttribute('href')).toBe(resourceOrigin.url+"/app/manifest.json");
  61 |   expect(await page.locator('head link[rel="icon"],head link[rel="manifest"]').evaluateAll(nodes=>nodes.map(n=>n.outerHTML))).toEqual(before);
  62 | });
  63 | 
  64 | test("Q3021 mounts a nested runtime grandchild with distinct executing Realms and destroys the full tree",async({page})=>{
  65 |   const {mountBatch02,expectNestedRealms,destroyBatch02}=await import('./upstream-batch02-components-fixture');
  66 |   await mountBatch02(page,"sortable",{nested:true});
  67 |   await expectNestedRealms(page);
  68 |   const list=page.locator('.batch02-sortable');
  69 |   await list.getByText('Alpha',{exact:true}).dragTo(list.getByText('Gamma',{exact:true}),{targetPosition:{x:120,y:50}});
  70 |   await expect(list).toHaveAttribute('data-order','Beta,Gamma,Alpha,Delta');
  71 |   await destroyBatch02(page);
  72 |   await expect(page.locator('#batch02-slot micro-app-host, #batch02-slot iframe')).toHaveCount(0);
  73 | });
  74 | 
```