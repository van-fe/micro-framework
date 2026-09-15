import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import { build, createServer as createViteServer, type Plugin } from 'vite';

/** Compile real Vue SFC/scoped CSS, CSS modules and React effect code with the pinned Vite. */
export function upstreamBatch03DomFixture(): Plugin {
  let shutdown = async () => {};
  return { name: 'upstream-batch03-dom-fixture', closeBundle() { return shutdown(); }, async configureServer(vite) {
    const vueRequire = createRequire(new URL('../../examples/vue-app/package.json', import.meta.url));
    const reactRequire = createRequire(new URL('../../examples/react-app/package.json', import.meta.url));
    const vuePlugin = (await import(vueRequire.resolve('@vitejs/plugin-vue'))).default;
    const root = fileURLToPath(new URL('./fixtures/upstream-batch03-dom/', import.meta.url));
    const resolve = { alias: [
        { find: /^vue$/, replacement: vueRequire.resolve('vue/dist/vue.runtime.esm-bundler.js') },
        { find: /^react$/, replacement: reactRequire.resolve('react') },
        { find: /^react-dom\/client$/, replacement: reactRequire.resolve('react-dom/client') },
      ] };
    const result = await build({ configFile: false, root, base: './', logLevel: 'error', plugins: [vuePlugin()],
      resolve,
      build: { write: false, assetsInlineLimit: 0, rollupOptions: { input: { react: `${root}react.html`, vue: `${root}vue.html` } } },
    });
    const dev = await createViteServer({ configFile: false, root, logLevel:'error', plugins:[vuePlugin()], resolve,
      server:{host:'127.0.0.1',port:0,hmr:false,cors:true}, build:{assetsInlineLimit:0},
    });
    await dev.listen();
    const devOrigin = `http://127.0.0.1:${(dev.httpServer!.address() as AddressInfo).port}`;
    const assets = new Map<string, string | Uint8Array>();
    for (const output of Array.isArray(result) ? result : [result]) {
      if (!('output' in output)) throw new Error('Expected completed Vite output');
      for (const asset of output.output) assets.set(asset.fileName, asset.type === 'chunk' ? asset.code : asset.source);
    }
    const requests: string[] = [];
    const early = '<!doctype html><html><head></head><script>const s=document.createElement("style");s.textContent=".batch03-early{color:rgb(123,45,67)}";document.head.appendChild(s);const l=document.createElement("link");l.rel="stylesheet";l.href="./early.css";document.head.appendChild(l);window.Batch03App={mount(){},unmount(){}};</script><body><p class="batch03-early">Early</p><p class="batch03-link">Link</p></body></html>';
    const server = createServer(async (request, response) => {
      const path = new URL(request.url ?? '/', 'http://fixture.invalid').pathname;
      requests.push(path);
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Cache-Control', 'no-store');
      let data: string | Uint8Array | undefined;
      if (path === '/requests') data = JSON.stringify(requests);
      else if (path === '/app/comp.js') data = await readFile(`${root}comp.js`);
      else if (path === '/app/early.html') data = early;
      else if (path === '/app/early.css') data = '.batch03-link{color:rgb(76,54,32)}';
      else data = assets.get(path.replace(/^\/app\//, ''));
      if (data === undefined) { response.statusCode = 404; response.end('Unknown DOM fixture'); return; }
      const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.svg') ? 'image/svg+xml' : path === '/requests' ? 'application/json' : 'text/html';
      response.setHeader('Content-Type', type); response.end(data);
    });
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    vite.middlewares.use((request, response, next) => {
      if (request.url !== '/__batch03-dom-origin') return next();
      response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({origin,devOrigin}));
    });
    let closing: Promise<void> | undefined;
    shutdown = () => closing ??= Promise.all([dev.close(), new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))]).then(() => {});
    vite.httpServer?.once('close', () => { void shutdown(); });
  } };
}
