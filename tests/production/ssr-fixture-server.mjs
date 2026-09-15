import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { renderSsrApplicationStream } from "../../packages/ssr/dist/index.js";
import { createRequire } from "node:module";

const requireFramework = createRequire(new URL("../../examples/ssr-host/package.json", import.meta.url));
async function frameworkBody(framework) {
  if (framework === "react") {
    const { createElement: h } = requireFramework("react");
    const { renderToString } = requireFramework("react-dom/server");
    return renderToString(h("article", { "data-ssr-root": "" },
      h("h1", { "data-ssr-title": "" }, "Server orders"),
      h("button", { type: "button" }, "SSR count: 5")));
  }
  const { createSSRApp, h } = requireFramework("vue");
  const { renderToString } = requireFramework("vue/server-renderer");
  return renderToString(createSSRApp({ render: () => h("article", { "data-ssr-root": "" }, [
    h("h1", { "data-ssr-title": "" }, "Server orders"), h("button", { type: "button" }, "SSR count: 5"),
  ]) }));
}

const distRoot = resolve("examples/ssr-host/dist");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

async function* serverBody() {
  yield '<article data-ssr-root><h1 data-ssr-title>Server orders</h1>';
  await Promise.resolve();
  yield '<button type="button" data-ssr-counter>SSR count: <span>5</span></button></article>';
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:4276");
  if (url.pathname === "/") {
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
      "x-micro-frame-stream": "v1",
    });
    response.write('<!doctype html><html><head><meta charset="UTF-8"><title>SSR hydration</title></head><body><div id="ssr-slot">');
    for await (const chunk of renderSsrApplicationStream({
      name: "ssr-orders",
      hydrationKey: "orders-main",
      body: ["react", "vue"].includes(url.searchParams.get("framework"))
        ? await frameworkBody(url.searchParams.get("framework")) : serverBody(),
      head: "<style>[data-ssr-root]{padding:24px;background:#eef8f4}button{font:inherit}</style>",
    })) response.write(chunk);
    response.write('</div>');
    setTimeout(() => response.end('<script type="module" src="/assets/ssr-client.js"></script></body></html>'), 800);
    return;
  }

  const file = resolve(distRoot, `.${decodeURIComponent(url.pathname)}`);
  if (!file.startsWith(`${distRoot}/`)) {
    response.writeHead(403).end("forbidden");
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": contentTypes[extname(file)] ?? "application/octet-stream",
    }).end(body);
  } catch {
    response.writeHead(404).end("not found");
  }
}).listen(4276, "127.0.0.1");
