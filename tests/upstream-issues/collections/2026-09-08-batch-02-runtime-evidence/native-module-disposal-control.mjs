// Native module/cache and detached Promise controls. No framework code or OS clipboard.
import { createServer } from "node:http";
import { chromium, firefox, webkit } from "@playwright/test";

let version = 1;
let missing = false;
const requests = [];
const server = createServer((request, response) => {
  requests.push(request.url);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Access-Control-Allow-Origin", "*");
  if (request.url.startsWith("/entry")) {
    response.setHeader("Content-Type", "text/javascript");
    response.statusCode = missing ? 404 : 200;
    response.end(missing ? "missing" : `export const version = ${version}; export const ownArray = Array;`);
  } else if (request.url.startsWith("/bootstrap.js")) {
    response.setHeader("Content-Type", "text/javascript");
    response.end("try { window.result(await import(window.entry)); } catch(error) { window.result({ error: String(error) }); }");
  } else {
    response.setHeader("Content-Type", "text/html");
    response.end("<!doctype html><title>Native module disposal control</title><body></body>");
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const [name, engine] of Object.entries(process.env.ENGINE === "webkit" ? { webkit } : { chromium, firefox, webkit })) {
    const browser = await engine.launch();
    console.log(JSON.stringify({ kind: "engine", name, version: browser.version(), platform: process.platform }));
    try {
      for (const preload of (process.env.PRELOAD_CONTROL ? process.env.PRELOAD_CONTROL.split(",") : ["none", "kept", "removed", "native-entry"])) {
        for (const initialization of ["url", "blank"]) {
          const context = await browser.newContext();
          const page = await context.newPage();
          await page.goto(origin + "/host.html");
          const outputs = [];
          for (const step of ["v1", "v2", "removed", "restored"]) {
            version = step === "v1" ? 1 : 2;
            missing = step === "removed";
            requests.length = 0;
            const result = await page.evaluate(async ({ origin, preload, initialization }) => {
              const frame = document.createElement("iframe"); frame.hidden = true;
              if (initialization === "url") frame.src = origin + "/realm.html";
              const loaded = new Promise(resolve => frame.onload = resolve);
              document.body.append(frame); await loaded;
              const win = frame.contentWindow;
              const entry = origin + "/entry.js";
              let link;
              if (preload !== "none") {
                link = win.document.createElement("link"); link.rel = preload === "fetch" ? "preload" : "modulepreload"; link.href = entry;
                if (preload === "fetch") { link.as = "script"; link.crossOrigin = "anonymous"; }
                win.document.head.append(link);
              }
              if (preload === "native-entry") {
                await new Promise(resolve => {
                  const nativeEntry = win.document.createElement("script");
                  nativeEntry.type = "module"; nativeEntry.src = entry;
                  nativeEntry.onload = nativeEntry.onerror = resolve;
                  win.document.head.append(nativeEntry);
                });
              }
              const output = await new Promise(resolve => {
                win.entry = entry;
                win.result = value => resolve(value.error ? value : { version: value.version, distinct: value.ownArray !== Array });
                const script = win.document.createElement("script");
                script.type = "module"; script.src = origin + "/bootstrap.js";
                win.document.head.append(script);
              });
              if (preload === "removed") link.remove();
              if (preload === "stop") win.stop();
              if (preload === "open") { win.document.open(); win.document.write("<!doctype html><title>Disposed</title>"); win.document.close(); }
              if (preload === "navigate") {
                const unloaded = new Promise(resolve => frame.onload = resolve);
                frame.src = "about:blank"; await unloaded;
              }
              frame.remove();
              return output;
            }, { origin, preload, initialization });
            outputs.push({ step, result, requests: [...requests] });
          }
          console.log(JSON.stringify({ kind: "module", name, preload, initialization, outputs }));
          await context.close();
        }
      }
      const page = await browser.newPage();
      await page.goto(origin + "/host.html");
      const promises = await page.evaluate(async () => {
        const frame = document.createElement("iframe"); frame.src = "/realm.html";
        const loaded = new Promise(resolve => frame.onload = resolve);
        document.body.append(frame); await loaded;
        const FramePromise = frame.contentWindow.Promise;
        const FrameDOMException = frame.contentWindow.DOMException;
        frame.remove();
        const results = [];
        for (const kind of ["frame", "host"]) {
          const exception = new FrameDOMException("Disposed", "AbortError");
          const rejected = (kind === "frame" ? FramePromise : Promise).reject(exception);
          const result = await Promise.race([
            rejected.then(() => "resolved", error => ({ name: error.name, frameBrand: error instanceof FrameDOMException })),
            new Promise(resolve => setTimeout(() => resolve("unsettled after 100ms"), 100)),
          ]);
          results.push({ kind, result });
        }
        return results;
      });
      console.log(JSON.stringify({ kind: "detached-promise", name, promises }));
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
