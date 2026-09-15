import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test as base } from './upstream-runtime-fixture';

interface SlowDeployment {
  url: string;
  blocked: 'script' | 'style';
  slow: boolean;
  requests: string[];
  requestUrls: string[];
  aborted: string[];
}
export const test = base.extend<{ slowDeployment: SlowDeployment }>({
  slowDeployment: async ({}, use) => {
    const deployment: SlowDeployment = { url: '', blocked: 'script', slow: true, requests: [], requestUrls: [], aborted: [] };
    const server = createServer((request, response) => {
      const path = new URL(request.url!, 'http://localhost').pathname;
      deployment.requests.push(path); deployment.requestUrls.push(request.url!);
      response.setHeader('Access-Control-Allow-Origin', '*');
      response.setHeader('Cache-Control', 'no-store');
      if (deployment.slow && path === (deployment.blocked === 'script' ? '/slow.js' : '/slow.css')) {
        // Do not end the response: only a browser-side close can satisfy aborted.
        response.on('close', () => { if (!response.writableEnded) deployment.aborted.push(path); });
        return;
      }
      if (path === '/index.html') {
        response.setHeader('Content-Type', 'text/html');
        const stylesheet = './slow.css';
        response.end(`<!doctype html><link rel="stylesheet" href="${stylesheet}"><div id="slow-root"></div><script src="./slow.js"></script>`);
      } else if (path === '/slow.css') {
        response.setHeader('Content-Type', 'text/css');
        response.end('.slow-counter { color: rgb(12, 34, 56); }');
      } else if (path === '/slow.js') {
        response.setHeader('Content-Type', 'text/javascript');
        response.end(`window.batch04Slow = {
          mount(props) {
            let count = 0;
            const button = document.createElement('button'); button.className = 'slow-counter';
            button.textContent = 'HTML recovered: 0';
            button.onclick = () => { button.textContent = 'HTML recovered: ' + (++count); };
            props.container.appendChild(button);
          },
          unmount(props) { props.container.replaceChildren(); }
        };`);
      } else { response.statusCode = 404; response.end('Not found'); }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    deployment.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/index.html`;
    try { await use(deployment); }
    finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  },
});
export { addSlot, expect } from './upstream-runtime-fixture';
