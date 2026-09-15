import { fileURLToPath } from "node:url";
import { test, expect, addSlot, installRouteLinks, routeTo, expectStatus } from "./upstream-runtime-fixture";
import { isolateBrowserProcess } from "./browser-process-fixture";

isolateBrowserProcess(import.meta.url);

const libraries = {
  dompurify: fileURLToPath(new URL("../../node_modules/dompurify/dist/purify.min.js", import.meta.url)),
  eruda: fileURLToPath(new URL("../../node_modules/eruda/eruda.js", import.meta.url)),
  emotion: fileURLToPath(new URL("../../node_modules/@emotion/css/dist/emotion-css.umd.min.js", import.meta.url)),
};

test.beforeEach(async ({ page }) => {
  for (const [name, path] of Object.entries(libraries)) await page.route(`**/batch02-${name}.js`, route => route.fulfill({path, contentType:"text/javascript"}));
});

const documentEntry = (library: string, source: string) => `<!doctype html><html><head><script src="/batch02-${library}.js"></script></head><body><script>${source}</script></body></html>`;

test("W262 DOMPurify 2.3.0 sanitizes parsed documents inside its native application Realm", async ({ page }) => {
  await page.route("**/batch02-purify.html", route => route.fulfill({contentType:"text/html",body:documentEntry("dompurify", `
    window.batch02Library = {mount(props) {
      const result = DOMPurify.sanitize('<section><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">safe</a></section>');
      const node = document.createElement('output'); node.dataset.purify = ''; node.textContent = result; props.container.append(node);
      node.dataset.version = DOMPurify.version;
    },unmount(props) { props.container.replaceChildren(); }};
  `)}));
  await addSlot(page,"purify-case");
  await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    const handle = await state.runtime.mountApp({name:"purify",entry:{type:"html",url:new URL("/batch02-purify.html",location.href).href,globalName:"batch02Library"},container:state.slots[0]!});
    state.handles.push(handle);
  });
  await expect(page.locator("[data-purify]")).toHaveAttribute("data-version","2.3.0");
  await expect(page.locator("[data-purify]")).toHaveText('<section><img src="x"><a>safe</a></section>');
  expect(await page.evaluate(() => "DOMPurify" in window)).toBe(false);
});

test("Q2137 eruda 2.4.1 initializes and destroys its dynamic styles in a nested application", async ({ page }) => {
  await page.route("**/batch02-eruda.html", route => route.fulfill({contentType:"text/html",body:documentEntry("eruda", `
    window.batch02Library = {mount(props) {
      eruda.init({tool:['console']});
      const node = document.createElement('output'); node.dataset.erudaReady = ''; node.textContent = eruda.version; props.container.append(node);
    },unmount(props) {eruda.destroy(); props.container.replaceChildren();}};
  `)}));
  await addSlot(page,"eruda-outer");
  await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    const outer = await state.runtime.mountApp({name:"eruda-outer",entry:{type:"module",url:new URL("/upstream-runtime-counter.js",location.href).href},container:state.slots[0]!});
    state.handles.push(outer);
    const body = state.slots[0]!.querySelector("micro-app-host")!.shadowRoot!.querySelector("micro-app-body")!;
    const nested = body.appendChild(document.createElement("div"));
    const handle = await state.runtime.mountApp({name:"eruda-inner",entry:{type:"html",url:new URL("/batch02-eruda.html",location.href).href,globalName:"batch02Library"},container:nested});
    state.handles.push(handle);
  });
  await expect(page.locator("[data-eruda-ready]")).toHaveText("2.4.1");
  await expect(page.locator(".eruda-container")).toHaveCount(1);
  const entry = page.locator(".eruda-entry-btn");
  await expect(entry).toBeVisible();
  await expect(entry).toHaveCSS("width","40px");
  await entry.click();
  const consoleTab = page.locator(".eruda-nav-bar-item").filter({hasText:/^console$/i});
  await expect(consoleTab).toBeVisible();
  await expect(consoleTab).toHaveCSS("font-size","12px");
  await consoleTab.click();
  await expect(page.locator("#eruda-console")).toBeVisible();
  await entry.click();
  await expect(page.locator(".eruda-dev-tools")).toBeHidden();
  expect(await page.evaluate(() => "eruda" in window)).toBe(false);
  await page.evaluate(() => window.__upstreamRuntime__!.handles[1]!.unmount());
  await expect(page.locator(".eruda-container")).toHaveCount(0);
});

for (const keepAlive of [true,false]) test(`Q2141 Emotion 11 keeps generated CSS correct over A to B to A (keepAlive=${keepAlive})`, async ({page}) => {
  await page.route("**/batch02-emotion.html", route => route.fulfill({contentType:"text/html",body:documentEntry("emotion", `
    const cls = emotion.css({color:'rgb(19, 37, 73)',paddingLeft:'13px'});
    window.batch02Library = {mount(props) {
      const node = document.createElement('button'); node.className = cls; node.dataset.emotionProbe = ''; node.textContent='Emotion styled'; props.container.append(node);
    },unmount(props) {props.container.replaceChildren();}};
  `)}));
  await addSlot(page,"emotion-a"); await addSlot(page,"emotion-b"); await installRouteLinks(page);
  await page.evaluate(({keepAlive}) => {
    const state = window.__upstreamRuntime__!;
    state.runtime.registerApps([{name:"emotion-a",entry:{type:"html",url:new URL("/batch02-emotion.html",location.href).href,globalName:"batch02Library"},container:state.slots[0]!,activeWhen:"/a",keepAlive}]);
    state.runtime.registerApps([{name:"emotion-b",entry:{type:"module",url:new URL("/upstream-runtime-counter.js",location.href).href},container:state.slots[1]!,activeWhen:"/b"}]);
  }, {keepAlive});
  await page.evaluate(() => window.__upstreamRuntime__!.runtime.start());
  await routeTo(page,"a"); await expectStatus(page,"emotion-a","mounted");
  const button = page.locator("[data-emotion-probe]");
  await expect(button).toHaveCSS("color","rgb(19, 37, 73)"); await expect(button).toHaveCSS("padding-left","13px");
  await routeTo(page,"b"); await expectStatus(page,"emotion-b","mounted");
  await routeTo(page,"a"); await expectStatus(page,"emotion-a","mounted");
  await expect(button).toBeVisible(); await expect(button).toHaveCSS("color","rgb(19, 37, 73)"); await expect(button).toHaveCSS("padding-left","13px");
  expect(await page.evaluate(() => "emotion" in window)).toBe(false);
});

test("W1065 a root-relative target blank link opens the application origin in a native popup", async ({page,context}) => {
  await page.route("**/batch02-popup-entry.html", route => route.fulfill({contentType:"text/html",headers:{"access-control-allow-origin":"*"},body:`<!doctype html><html><body><a id="app-popup" href="/batch02-popup-target.html" target="_blank" rel="noopener">Open application target</a><script>window.batch02Library={mount(){},unmount(){document.body.replaceChildren()}};</script></body></html>`}));
  await context.route("**/batch02-popup-target.html", route => route.fulfill({contentType:"text/html",body:"<!doctype html><title>Application popup</title><body>Application origin target</body>"}));
  await addSlot(page,"popup-case");
  const hostURL = page.url();
  await page.evaluate(async () => {
    const state = window.__upstreamRuntime__!;
    const handle = await state.runtime.mountApp({name:"popup",entry:{type:"html",url:"http://127.0.0.1:5174/batch02-popup-entry.html",globalName:"batch02Library"},container:state.slots[0]!});
    state.handles.push(handle);
  });
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link",{name:"Open application target"}).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL("http://127.0.0.1:5174/batch02-popup-target.html");
  await expect(popup.getByText("Application origin target")).toBeVisible();
  expect(page.url()).toBe(hostURL);
  await popup.close();
});
