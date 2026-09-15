import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium, firefox, webkit } = require('@playwright/test');
const results = [];
let available = true;
const html = '<!doctype html><html><head><meta charset="UTF-8"></head><body></body></html>';
const worker = `
addEventListener('install', event => event.waitUntil(skipWaiting()));
addEventListener('activate', event => event.waitUntil(clients.claim()));
addEventListener('fetch', event => event.respondWith((async () => await (await caches.open('native')).match(event.request) || fetch(event.request))()));
addEventListener('message', event => event.waitUntil((async () => {
  const request = new Request(location.origin + '/realm.html', {cache:'reload',credentials:'same-origin',mode:'cors'});
  const response = await fetch(request); const type=response.type;
  await (await caches.open('native')).put(request,response);
  event.ports[0].postMessage({type});
})()));`;
const server = createServer((req,res) => {
  if (!available) { req.socket.destroy(); return; }
  const body=req.url==='/sw.js'?worker:html;
  res.writeHead(200, {'content-type':req.url==='/sw.js'?'text/javascript':'text/html','cache-control':'no-store'});
  res.end(body);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
try {
  for (const [name,engine] of Object.entries({chromium,firefox,webkit})) {
    const browser=await engine.launch();
    try {
      for (const mode of ['setOffline','socketFailure']) {
        available=true;
        const context=await browser.newContext();
        const page=await context.newPage();
        const failed=[]; page.on('requestfailed', req=>failed.push({url:req.url(),failure:req.failure()}));
        await page.goto(origin);
        const setup=await page.evaluate(async()=> {
          await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
          if (!navigator.serviceWorker.controller) await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
          return await new Promise(resolve=> {const {port1,port2}=new MessageChannel();port1.onmessage=event=>resolve(event.data);navigator.serviceWorker.controller.postMessage({},[port2]);});
        });
        if (mode==='setOffline') await context.setOffline(true); else available=false;
        const navigation=await page.evaluate(async()=> {
          const frame=document.createElement('iframe');frame.src='/realm.html';document.body.append(frame);
          return await new Promise(resolve=> {
            const timeout=setTimeout(()=>resolve({timeout:true,url:frame.contentWindow?.location.href}),5000);
            frame.onload=()=> {clearTimeout(timeout);resolve({timeout:false,url:frame.contentWindow?.location.href,controlled:Boolean(frame.contentWindow?.navigator.serviceWorker.controller)});};
          });
        });
        results.push({name,mode,setup,navigation,failed});
        available=true; await context.setOffline(false);await context.close();
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve=>server.close(resolve)); }
if (process.argv[2]) await writeFile(process.argv[2],JSON.stringify(results,null,2));
process.stdout.write(JSON.stringify(results,null,2)+'\n');
