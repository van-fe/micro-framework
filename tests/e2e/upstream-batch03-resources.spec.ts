import { test, expect, addSlot } from "./upstream-batch03-resources-fixture";
import { isolateBrowserProcess } from "./browser-process-fixture";

isolateBrowserProcess(import.meta.url);

for (const registered of [false, true]) test(`Q3090 applies declarative include credentials to entry and dynamic script (registered=${registered})`, async ({page,resourceOrigin})=>{
  await page.context().addCookies([{name:"batch03",value:"credential",url:resourceOrigin.url,sameSite:"Lax"}]);
  await addSlot(page,"resource-slot");
  await page.evaluate(async ({url,registered})=>{
    const s=window.__upstreamRuntime__!;
    const app={name:"resource-app",container:"#resource-slot",activeWhen:()=>true,entry:{type:"html" as const,url:url+"/app/entry.html",credentials:"include" as const}};
    if(registered){s.runtime.registerApps([app]);await s.runtime.start({preload:false});}
    else s.handles.push(await s.runtime.mountApp(app));
  },{url:resourceOrigin.url,registered});
  await expect(page.getByRole("button",{name:"Request child API"})).toBeVisible();
  const requests=resourceOrigin.requests.filter(r=>r.path.endsWith("entry.html")||r.path.endsWith("dynamic.js"));
  expect(requests.map(r=>r.path)).toEqual(["/app/entry.html","/app/dynamic.js"]);
  expect(requests.every(r=>r.cookie.includes("batch03=credential"))).toBe(true);
  expect(await page.evaluate(()=>Reflect.has(window,"resourceExecuted"))).toBe(false);
});

test("Q3035 W1005 resolve static and dynamic image and SVG href before requests with host same-name decoys", async ({page,resourceOrigin})=>{
  const wrong:string[]=[];
  await page.route('http://127.0.0.1:5173/**/same.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="41" height="43"/>'}));
  page.on("request",request=>{if(request.url().includes("same.svg")&&!request.url().startsWith(resourceOrigin.url)) wrong.push(request.url());});
  await addSlot(page,"resource-slot");
  await page.evaluate(async url=>{const s=window.__upstreamRuntime__!;s.handles.push(await s.runtime.mountApp({name:"images",container:"#resource-slot",entry:{type:"html",url:url+"/app/entry.html"}}));},resourceOrigin.url);
  await expect.poll(()=>page.locator("#resource-slot img").evaluateAll(nodes=>nodes.map(n=>(n as HTMLImageElement).naturalWidth))).toEqual([13,13]);
  for(const id of ["static-svg","dynamic-svg"]){
    expect(await page.locator('#'+id).evaluate(n=>n.getAttribute('href')||n.getAttributeNS('http://www.w3.org/1999/xlink','href'))).toBe(resourceOrigin.url+"/app/same.svg");
    expect(await page.locator('#'+id).evaluate(n=>(n as SVGGraphicsElement).getBBox().width)).toBe(26);
  }
  expect(wrong).toEqual([]);
  expect(resourceOrigin.requests.some(r=>r.path==="/app/same.svg")).toBe(true);
});

test("Q3056 W995 keep explicit child API origin and host Axios baseURL during Vue Router guards",async({page,resourceOrigin})=>{
  await addSlot(page,"resource-slot");
  await page.evaluate(async url=>{
    const moduleURL="http://127.0.0.1:5176/src/upstream-batch03-host-requests.ts";
    const module=await import(/* @vite-ignore */ moduleURL);
    Reflect.set(window,"batch03HostRequests",module.createRequests(url));
  },resourceOrigin.url);
  for(let cycle=0;cycle<2;cycle++){
    await page.evaluate(async url=>{const s=window.__upstreamRuntime__!;s.handles.push(await s.runtime.mountApp({name:"api-child",container:"#resource-slot",entry:{type:"html",url:url+"/app/entry.html"}}));},resourceOrigin.url);
    const button=page.getByRole("button",{name:"Request child API"}); await button.click();await expect(button).toHaveAttribute("data-result",new URL(resourceOrigin.url).host);
    const result=await page.evaluate(async cycle=>(Reflect.get(window,"batch03HostRequests") as {navigate(path:string):Promise<unknown>}).navigate('/host-'+cycle),cycle);
    expect(result).toEqual({origin:new URL(resourceOrigin.url).host,path:"/host-api/api/data"});
    await page.evaluate(async()=>{await window.__upstreamRuntime__!.handles.at(-1)!.dispose();});
  }
  expect(resourceOrigin.requests.filter(r=>r.path==="/host-api/api/data")).toHaveLength(2);
  expect(resourceOrigin.requests.filter(r=>r.path==="/app/api/data")).toHaveLength(2);
});

test("Q2982 keeps explicit favicon and manifest paths in application subdirectory without replacing host metadata",async({page,resourceOrigin})=>{
  const before=await page.locator('head link[rel="icon"],head link[rel="manifest"]').evaluateAll(nodes=>nodes.map(n=>n.outerHTML));
  await addSlot(page,"resource-slot");
  await page.evaluate(async url=>{const s=window.__upstreamRuntime__!;s.handles.push(await s.runtime.mountApp({name:"metadata",container:"#resource-slot",entry:{type:"html",url:url+"/app/entry.html"}}));},resourceOrigin.url);
  expect(await page.locator('#resource-slot link[rel="icon"]').getAttribute('href')).toBe(resourceOrigin.url+"/app/favicon.svg");
  expect(await page.locator('#resource-slot link[rel="manifest"]').getAttribute('href')).toBe(resourceOrigin.url+"/app/manifest.json");
  expect(await page.locator('head link[rel="icon"],head link[rel="manifest"]').evaluateAll(nodes=>nodes.map(n=>n.outerHTML))).toEqual(before);
});

test("Q3021 mounts a nested runtime grandchild with distinct executing Realms and destroys the full tree",async({page})=>{
  const {mountBatch02,expectNestedRealms,destroyBatch02}=await import('./upstream-batch02-components-fixture');
  await mountBatch02(page,"sortable",{nested:true});
  await expectNestedRealms(page);
  const list=page.locator('.batch02-sortable');
  await list.getByText('Alpha',{exact:true}).dragTo(list.getByText('Gamma',{exact:true}),{targetPosition:{x:120,y:50}});
  await expect(list).toHaveAttribute('data-order','Beta,Gamma,Alpha,Delta');
  await destroyBatch02(page);
  await expect(page.locator('#batch02-slot micro-app-host, #batch02-slot iframe')).toHaveCount(0);
});
