// Standalone native controls; no framework or Vite code is loaded.
import { createServer } from 'node:http';
import { chromium, firefox, webkit } from '@playwright/test';
const requests = [];
const server = createServer((request, response) => { requests.push(request.url); response.setHeader('content-type', 'text/html'); response.end('<!doctype html><title>Native iframe history control</title>'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/host.html`;
try {
 for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  try {
   const page = await browser.newPage();
   await page.goto(url);
   const result = await page.evaluate(async () => {
    const outputs = [];
    for (const initialize of ['none', 'open', 'srcdoc', 'url']) {
     const iframe = document.createElement('iframe'); iframe.hidden = true;
     if (initialize === 'srcdoc' || initialize === 'url') {
      const loaded = new Promise(resolve => iframe.addEventListener('load', resolve, { once: true }));
      if (initialize === 'srcdoc') iframe.srcdoc = '<!doctype html><html><head></head><body></body></html>';
      else iframe.src = '/realm.html';
      document.body.append(iframe); await loaded;
     } else document.body.append(iframe);
     const frame = iframe.contentWindow;
     const before = frame.location.href;
     if (initialize === 'open') { frame.document.open(); frame.document.write('<!doctype html><html><head></head><body></body></html>'); frame.document.close(); }
     const initialized = frame.location.href;
     let error;
     try { frame.history.replaceState({}, '', new URL('/history/home', location.href).href); }
     catch (cause) { error = `${cause.name}: ${cause.message}`; }
     outputs.push({ initialize, before, initialized, after: frame.location.href, error: error ?? null,
      distinctRealm: frame.Array !== Array, hostURL: location.href });
     iframe.remove();
    }
    return outputs;
   });
   console.log(JSON.stringify({ name, result, requests }));
  } finally { await browser.close(); }
 }
} finally { server.close(); }
