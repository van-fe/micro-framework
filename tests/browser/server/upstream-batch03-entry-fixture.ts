import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Plugin } from 'vite';
import { buildEntryFixtures } from './upstream-batch03-entry-builds';

export function upstreamBatch03EntryFixture(): Plugin {
  let shutdown = async () => {};
  return { name:'upstream-batch03-entry', closeBundle(){return shutdown();}, async configureServer(vite) {
    const bundle = await buildEntryFixtures();
    const requests: string[] = [];
    const order = '<script>window.batch03Order=[]; Promise.resolve().then(()=>window.batch03Order.push(2))</script><script>window.batch03Order.push(1);window.Batch03Order={mount(){},unmount(){}}</script>';
    const server = createServer((request,response)=>{
      const url=new URL(request.url??'/', 'http://fixture.invalid');
      requests.push(url.pathname);
      const assetPath=url.pathname.replace(/^\/vite-count(?:-[a-z0-9-]+)?\//,'/vite/');
      response.setHeader('Access-Control-Allow-Origin','*');
      response.setHeader('Cache-Control','no-store');
      let type='text/html',body: string|Buffer|undefined;
      if(url.pathname==='/requests') {type='application/json';body=JSON.stringify(requests);}
      else if(/^\/(auto|relative)\/index.html$/.test(url.pathname))body='<script src="./public/main.js"></script>';
      else if(url.pathname==='/dll/index.html')body='<script src="./dll.js"></script><script src="./app.js"></script>';
      else if(url.pathname==='/federation/index.html')body='<script src="./remoteEntry.js"></script><script>window.Batch03Federation={async mount(p){await Batch03Remote.init({}); const factory=await Batch03Remote.get("./owner");const value=factory();window.batch03FederationOwner=value.owner();p.container.textContent="remote count "+value.counter()},unmount(p){p.container.replaceChildren()}}</script>';
      else if(url.pathname==='/order.html')body=order;
      else if(url.pathname==='/native-order.html')body=order+'<script>parent.postMessage({batch03Order:window.batch03Order},"*")</script>';
      else if(url.pathname==='/map/index.html')body='<script type="importmap">{"imports":{"batch03-lib":"./lib.js"}}</script><script type="module" src="./entry.js"></script>';
      else if(url.pathname==='/shared/index.html')body='<script type="module" src="/map/entry.js"></script>';
      else if(url.pathname==='/map/scopes.html')body='<base href="/map/"><script type="importmap">{"imports":{"batch03-lib":"./lib.js","batch03-prefix/":"./pkg/"},"scopes":{"./scoped/":{"batch03-lib":"./scoped-lib.js"}}}</script><script type="module" src="./scopes-entry.js"></script>';
      else if(url.pathname==='/map/scopes-entry.js'){type='text/javascript';body='import {value} from "./scoped/consumer.js";import {prefix} from "batch03-prefix/value.js";export function mount(p){p.container.textContent=value+":"+prefix}export function unmount(p){p.container.replaceChildren()}';}
      else if(url.pathname==='/map/scoped/consumer.js'){type='text/javascript';body='export {value} from "batch03-lib";';}
      else if(url.pathname==='/map/scoped-lib.js'){type='text/javascript';body='export const value="scoped dependency";';}
      else if(url.pathname==='/map/pkg/value.js'){type='text/javascript';body='export const prefix="prefix dependency";';}
      else if(url.pathname==='/map/lib.js'){type='text/javascript';body='export const owner=window; export const value="authored import map";';}
      else if(url.pathname==='/map/entry.js'){type='text/javascript';body='import {owner,value} from "batch03-lib";window.batch03MapOwner=owner;export function mount(p){p.container.textContent=value} export function unmount(p){p.container.replaceChildren()}';}
      else if(assetPath==='/vite/remote.js'){type='text/javascript';body='window.batch03RemoteEvaluations=(window.batch03RemoteEvaluations||0)+1;export const owner=window;';}
      else if(bundle.assets.has(assetPath)){body=bundle.assets.get(assetPath);type=url.pathname.endsWith('.html')?'text/html':url.pathname.endsWith('.css')?'text/css':'text/javascript';}
      else {response.statusCode=404;body='Unknown batch03 entry fixture';}
      response.setHeader('Content-Type',type);response.end(body);
    });
    await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    vite.middlewares.use((request,response,next)=>{
      if(request.url!=='/__batch03-entry')return next();
      response.setHeader('Content-Type','application/json'); response.end(JSON.stringify({origin}));
    });
    let closed=false;
    shutdown=async()=>{if(closed)return;closed=true;if(server.listening){server.closeAllConnections();server.close();}await bundle.dispose();};
    server.unref();vite.httpServer?.once('close',()=>{void shutdown();});
  }};
}
