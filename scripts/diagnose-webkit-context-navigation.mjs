// Standalone WebKit navigation diagnostic: no framework or Vite code is loaded.
// Baseline: node scripts/diagnose-webkit-context-navigation.mjs --plain --no-route
// Process isolation control: add --batch-size=50 --total=150
// A navigation failure intentionally exits nonzero, retaining the original load timeout.
import { createServer } from 'node:http';
import { webkit, devices } from '@playwright/test';
let requests = 0;
const server = createServer((request, response) => {
  requests++;
  response.setHeader('content-type', 'text/html');
  response.end('<!doctype html><title>Empty context control</title><body>Loaded</body>');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/control`;
const withRoute = !process.argv.includes('--no-route');
const desktop = !process.argv.includes('--plain');
const batchSize = Number(process.argv.find((arg) => arg.startsWith('--batch-size='))?.split('=')[1] || Infinity);
const total = Number(process.argv.find((arg) => arg.startsWith('--total='))?.split('=')[1] || 80);
console.log(JSON.stringify({ withRoute, desktop, batchSize, total, executable: webkit.executablePath() }));
let browser = await webkit.launch();
try {
  for (let index = 1; index <= total; index++) {
    if (index > 1 && (index - 1) % batchSize === 0) {
      await browser.close();
      browser = await webkit.launch();
      console.log(JSON.stringify({ index, result: 'fresh-browser' }));
    }
    const context = await browser.newContext(desktop ? { ...devices['Desktop Safari'] } : {});
    const page = await context.newPage();
    if (withRoute) await page.route('**/upstream-runtime-counter.js', (route) => route.fulfill({ body: 'export const value=1;', contentType: 'text/javascript' }));
    const before = requests;
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
      console.log(JSON.stringify({ index, result: 'loaded', receivedRequests: requests - before }));
    } catch (error) {
      console.log(JSON.stringify({ index, result: 'failed', receivedRequests: requests - before, message: String(error), actualURL: page.url() }));
      throw error;
    } finally { await context.close(); }
  }
} finally { await browser.close(); server.close(); }
