import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const server = createServer((_request, response) => { response.setHeader("content-type", "text/html"); response.end("<h1>DevTools contract host</h1>"); });
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const extension = resolve("extensions/devtools");
let context;
try {
  context = await chromium.launchPersistentContext("", {
    channel: "chromium", headless: false, ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--auto-open-devtools-for-tabs", `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  const page = context.pages()[0];
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  // Fixture for the public discovery protocol, using the real extension API and browser transport.
  await page.evaluate(() => { window.__MICRO_FRAME_DEVTOOLS__ = { version: 1, list: () => [{ snapshot: () => ({
    runtimeId: "contract-runtime", applications: [1, 2].map((id) => ({ name: "orders", instanceId: `orders:${id}`, status: "mounted" })),
    records: [{ kind: "error", name: "orders", phase: "realm.error", error: { message: "<img src=x onerror=alert(1)>" } }],
  }) }] }; });
  const cdp = await context.browser().newBrowserCDPSession();
  const sessions = new Map();
  let sequence = 0;
  async function command(targetId, method, params) {
    if (!sessions.has(targetId)) sessions.set(targetId, (await cdp.send("Target.attachToTarget", { targetId, flatten: false })).sessionId);
    const sessionId = sessions.get(targetId);
    const id = ++sequence;
    return new Promise((resolveResult, reject) => {
      const timeout = setTimeout(() => { cdp.off("Target.receivedMessageFromTarget", listener); reject(new Error(`Timed out: ${method}`)); }, 10_000);
      const listener = (event) => {
        if (event.sessionId !== sessionId) return;
        const response = JSON.parse(event.message);
        if (response.id !== id) return;
        clearTimeout(timeout); cdp.off("Target.receivedMessageFromTarget", listener);
        if (response.error) reject(new Error(JSON.stringify(response.error)));
        else resolveResult(response.result);
      };
      cdp.on("Target.receivedMessageFromTarget", listener);
      cdp.send("Target.sendMessageToTarget", { sessionId, message: JSON.stringify({ id, method, params }) }).catch(reject);
    });
  }
  async function evaluate(targetId, expression) {
    const result = await command(targetId, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function target(suffix) {
    for (let i = 0; i < 50; i++) {
      const targets = (await cdp.send("Target.getTargets")).targetInfos;
      const found = targets.find((item) => item.url.startsWith("chrome-extension:") && item.url.endsWith(suffix));
      if (found) return found;
      await new Promise((ready) => setTimeout(ready, 100));
    }
    throw new Error(`Extension target missing: ${suffix} ${JSON.stringify((await cdp.send("Target.getTargets")).targetInfos)}`);
  }
  const devtools = await target("/devtools.html");
  // Select the production panel in the pinned DevTools frontend, as a user selecting its tab would.
  const extensionUrl = new URL(devtools.url);
  const panelId = `${extensionUrl.protocol}//${extensionUrl.host}MicroFrame`;
  await new Promise((ready) => setTimeout(ready, 1000));
  await evaluate(devtools.parentId, `(async () => {
    const UI = await import('./ui/legacy/legacy.js');
    const inspector = UI.InspectorView.InspectorView.instance();
    if (!inspector.hasPanel(${JSON.stringify(panelId)})) throw new Error('Micro Frame panel was not registered: ' + JSON.stringify(inspector.tabbedPane.tabIds()));
    await inspector.showPanel(${JSON.stringify(panelId)});
    return true;
  })()`);
  const panel = await target("/panel.html");
  let text = "";
  for (let i = 0; i < 50; i++) {
    text = await evaluate(panel.targetId, "document.body.innerText");
    if (text.includes("orders:2")) break;
    await new Promise((ready) => setTimeout(ready, 100));
  }
  assert.match(text, /contract-runtime/); assert.match(text, /orders:1/); assert.match(text, /orders:2/);
  assert.match(text, /<img src=x onerror=alert\(1\)>/);
  assert.equal(await evaluate(panel.targetId, "document.querySelectorAll('img').length"), 0);
  const targets = (await cdp.send("Target.getTargets")).targetInfos;
  const parent = targets.find((item) => item.targetId === panel.parentId);
  if (parent) {
    const screenshot = await command(parent.targetId, "Page.captureScreenshot", { format: "png" });
    await mkdir(".artifacts", { recursive: true });
    await writeFile(".artifacts/devtools-extension.png", Buffer.from(screenshot.data, "base64"));
  }
  await page.reload();
  for (let i = 0; i < 50; i++) {
    text = await evaluate(panel.targetId, "document.body.innerText");
    if (text.includes("No Runtime exposed")) break;
    await new Promise((ready) => setTimeout(ready, 100));
  }
  assert.match(text, /No Runtime exposed/);
  console.log("PASS: unpacked Chromium DevTools panel, real inspectedWindow transport, same-name instances, safe text rendering and navigation recovery.");
} finally { await context?.close(); server.close(); }
