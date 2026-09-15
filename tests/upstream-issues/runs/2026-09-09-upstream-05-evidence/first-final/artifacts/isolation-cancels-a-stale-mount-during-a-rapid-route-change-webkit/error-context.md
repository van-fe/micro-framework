# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: isolation.spec.ts >> cancels a stale mount during a rapid route change
- Location: tests/e2e/isolation.spec.ts:1299:1

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  locator('#runtime-status')
Expected: "mounted 4 applications"
Received: "mounted 1 applications"

Call log:
  - Expect "toHaveText" with timeout 5000ms
  - waiting for locator('#runtime-status')
    3 × locator resolved to <strong id="runtime-status">loading vue2-console</strong>
      - unexpected value "loading vue2-console"
    - locator resolved to <strong id="runtime-status">mounted 1 applications</strong>
    - unexpected value "mounted 1 applications"
  - Test ended.

```

```yaml
- strong: mounted 1 applications
```

# Test source

```ts
  1201 |     const host = slot.querySelector<HTMLElement>(
  1202 |       'micro-app-host[data-micro-app="manual-prewarm-contract"]',
  1203 |     )!;
  1204 |     const frame = host.querySelector("iframe")!.contentWindow as Window & {
  1205 |       __vanillaInstanceId__?: string;
  1206 |       __vanillaModuleCount__?: number;
  1207 |     };
  1208 |     const before = {
  1209 |       status: handle.getStatus(),
  1210 |       hidden: host.hidden,
  1211 |       inert: host.inert,
  1212 |       instanceId: frame.__vanillaInstanceId__,
  1213 |       moduleCount: frame.__vanillaModuleCount__,
  1214 |       iframe: host.querySelector("iframe"),
  1215 |     };
  1216 |     await handle.mount();
  1217 |     return {
  1218 |       before: { ...before, iframe: undefined },
  1219 |       status: handle.getStatus(),
  1220 |       hidden: host.hidden,
  1221 |       inert: host.inert,
  1222 |       sameIframe: before.iframe === host.querySelector("iframe"),
  1223 |       instanceId: frame.__vanillaInstanceId__,
  1224 |       moduleCount: frame.__vanillaModuleCount__,
  1225 |       text: host.shadowRoot?.querySelector("#vanilla-root")?.textContent,
  1226 |     };
  1227 |   });
  1228 | 
  1229 |   expect(result.before).toMatchObject({
  1230 |     status: "bootstrapped",
  1231 |     hidden: true,
  1232 |     inert: true,
  1233 |     moduleCount: 1,
  1234 |   });
  1235 |   expect(result.status).toBe("mounted");
  1236 |   expect(result.hidden).toBe(false);
  1237 |   expect(result.inert).toBe(false);
  1238 |   expect(result.sameIframe).toBe(true);
  1239 |   expect(result.instanceId).toBe(result.before.instanceId);
  1240 |   expect(result.moduleCount).toBe(1);
  1241 |   expect(result.text).toContain("Manual prewarm");
  1242 | 
  1243 |   await page.evaluate(async () => {
  1244 |     await window.__manualAppHandle__!.dispose();
  1245 |     document.querySelector("#manual-prewarm-slot")?.remove();
  1246 |   });
  1247 | });
  1248 | 
  1249 | test("rolls back to an ordered fallback Entry and cleans the failed Realm", async ({ page }) => {
  1250 |   await page.goto("/");
  1251 |   await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");
  1252 | 
  1253 |   const result = await page.evaluate(async () => {
  1254 |     const runtime = window.__microFrameRuntime__!;
  1255 |     const phases: string[] = [];
  1256 |     const off = runtime.errors.subscribe((event) => phases.push(event.phase));
  1257 |     const container = document.createElement("div");
  1258 |     document.body.append(container);
  1259 |     const handle = await runtime.mountApp({
  1260 |       name: "fallback-contract",
  1261 |       entry: { url: "http://127.0.0.1:5174/missing-primary-entry.js", type: "module" },
  1262 |       fallbackEntries: [
  1263 |         { url: "http://127.0.0.1:5174/src/lifecycle.ts", type: "module" },
  1264 |       ],
  1265 |       container,
  1266 |       props: { title: "Fallback contract" },
  1267 |     });
  1268 |     const hosts = container.querySelectorAll("micro-app-host");
  1269 |     const frame = hosts[0]!.querySelector("iframe")!;
  1270 |     const frameWindow = frame.contentWindow as Window & {
  1271 |       __vanillaModuleCount__?: number;
  1272 |       __vanillaInstanceId__?: string;
  1273 |     };
  1274 |     const snapshot = {
  1275 |       status: handle.getStatus(),
  1276 |       hostCount: hosts.length,
  1277 |       iframeCount: container.querySelectorAll("iframe").length,
  1278 |       moduleCount: frameWindow.__vanillaModuleCount__,
  1279 |       instanceId: frameWindow.__vanillaInstanceId__,
  1280 |       phases,
  1281 |     };
  1282 |     off();
  1283 |     await handle.dispose();
  1284 |     snapshot.hostCount = container.querySelectorAll("micro-app-host").length;
  1285 |     container.remove();
  1286 |     return snapshot;
  1287 |   });
  1288 | 
  1289 |   expect(result).toMatchObject({
  1290 |     status: "mounted",
  1291 |     hostCount: 0,
  1292 |     iframeCount: 1,
  1293 |     moduleCount: 1,
  1294 |     instanceId: expect.stringMatching(/^fallback-contract:/),
  1295 |     phases: ["load-fallback"],
  1296 |   });
  1297 | });
  1298 | 
  1299 | test("cancels a stale mount during a rapid route change", async ({ page }) => {
  1300 |   await page.goto("/");
> 1301 |   await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");
       |                                                 ^ Error: expect(locator).toHaveText(expected) failed
  1302 | 
  1303 |   await page.evaluate(() => {
  1304 |     const slot = document.createElement("div");
  1305 |     slot.id = "slow-route-slot";
  1306 |     document.body.append(slot);
  1307 |     window.__microFrameRuntime__!.registerApps([{
  1308 |       name: "slow-route",
  1309 |       entry: { url: "http://127.0.0.1:5174/src/slow-lifecycle.ts", type: "module" },
  1310 |       container: slot,
  1311 |       activeWhen: "/slow",
  1312 |     }]);
  1313 |     history.pushState({}, "", "/slow");
  1314 |     dispatchEvent(new PopStateEvent("popstate"));
  1315 |   });
  1316 | 
  1317 |   await page.waitForFunction(() => {
  1318 |     const iframe = document.querySelector<HTMLElement>(
  1319 |       'micro-app-host[data-micro-app="slow-route"]',
  1320 |     )?.querySelector("iframe");
  1321 |     return Boolean((iframe?.contentWindow as Window & { __slowMountStarted__?: boolean } | null)?.__slowMountStarted__);
  1322 |   });
  1323 | 
  1324 |   await page.evaluate(() => {
  1325 |     history.pushState({}, "", "/after-slow");
  1326 |     dispatchEvent(new PopStateEvent("popstate"));
  1327 |   });
  1328 | 
  1329 |   await expect(page.locator('micro-app-host[data-micro-app="slow-route"]')).toHaveCount(0);
  1330 |   await page.waitForTimeout(600);
  1331 |   expect(await page.evaluate(() => ({
  1332 |     status: window.__microFrameRuntime__!.getAppStatus("slow-route"),
  1333 |     staleRoot: Boolean(document.querySelector("#slow-route-root")),
  1334 |   }))).toEqual({ status: "unmounted", staleRoot: false });
  1335 | });
  1336 | 
  1337 | test("destroys the iframe Realm and Shadow surface", async ({ page }) => {
  1338 |   await page.goto("/");
  1339 |   await expect(page.locator("#runtime-status")).toHaveText("mounted 4 applications");
  1340 | 
  1341 |   await page.evaluate(async () => {
  1342 |     await window.__microFrameRuntime__!.destroy();
  1343 |   });
  1344 | 
  1345 |   await expect(page.locator("micro-app-host")).toHaveCount(0);
  1346 | });
  1347 | 
  1348 | declare global {
  1349 |   interface Window {
  1350 |     __manualAppHandle__?: { dispose(): Promise<void> };
  1351 |   }
  1352 | }
  1353 | 
```