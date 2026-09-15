import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test as base, expect, addSlot } from "./upstream-runtime-fixture";

export const test = base.extend<{ resourceOrigin: { url: string; requests: Array<{ path: string; cookie: string }> } }>({
  resourceOrigin: async ({}, use) => {
    const requests: Array<{ path: string; cookie: string }> = [];
    const server = createServer((request, response) => {
      const path = new URL(request.url!, "http://test").pathname;
      requests.push({ path, cookie: request.headers.cookie ?? "" });
      response.setHeader("Access-Control-Allow-Origin", request.headers.origin ?? "*");
      response.setHeader("Access-Control-Allow-Credentials", "true");
      response.setHeader("Cache-Control", "no-store");
      if (path.endsWith(".svg")) { response.setHeader("Content-Type", "image/svg+xml"); response.end('<svg xmlns="http://www.w3.org/2000/svg" width="13" height="17"><rect width="13" height="17" fill="red"/></svg>'); }
      else if (path.endsWith("/api/data")) { response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify({ origin: request.headers.host, path })); }
      else if (path.endsWith("dynamic.js")) { response.setHeader("Content-Type", "text/javascript"); response.end("window.resourceExecuted = (window.resourceExecuted || 0) + 1"); }
      else if (path.endsWith("entry.html")) {
        response.setHeader("Content-Type", "text/html");
        response.end('<!doctype html><head><link rel="icon" href="./favicon.svg"><link rel="manifest" href="./manifest.json"></head><body><img id="static-image" src="./same.svg"><svg width="26" height="34"><image id="static-svg" href="./same.svg" width="26" height="34"/></svg><script type="module" src="./entry.js"></script>');
      } else if (path.endsWith("manifest.json")) { response.setHeader("Content-Type", "application/manifest+json"); response.end('{"name":"child"}'); }
      else if (path.endsWith("entry.js")) {
        response.setHeader("Content-Type", "text/javascript");
        response.end(`
export async function mount(props) {
 const img=document.createElement('img'); img.id='dynamic-image'; img.src='./same.svg'; document.body.append(img);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('width','26');svg.setAttribute('height','34');
 const image=document.createElementNS(svg.namespaceURI,'image'); image.id='dynamic-svg'; image.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href','./same.svg'); image.setAttribute('width','26');image.setAttribute('height','34');svg.append(image);document.body.append(svg);
 await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./dynamic.js';s.onload=resolve;s.onerror=reject;document.body.append(s)});
 const button=document.createElement('button');button.textContent='Request child API';button.onclick=async()=>{ const data=await (await fetch(new URL('./api/data',import.meta.url))).json();button.dataset.result=data.origin; }; document.body.append(button);
}
export function unmount() { document.body.replaceChildren(); }
`);
      } else { response.statusCode=404;response.end("Not found"); }
    });
    await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
    const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try { await use({url,requests}); } finally { server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve())); }
  },
});
export { expect, addSlot };
