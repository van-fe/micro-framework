import { createServer } from "node:http";

const port = Number(process.env.MICRO_FRAME_BENCHMARK_FIXTURE_PORT ?? 4375);
const requestCounts = new Map<string, number>();
const flakyAttempts = new Map<string, number>();

function record(run: string | null, pathname: string): void {
  if (!run || pathname === "/stats") return;
  const key = `${run}:${pathname}`;
  requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1);
}

function html(run: string): string {
  const rules = Array.from({ length: 48 }, (_, index) =>
    `.benchmark-card:nth-child(${index + 1}) { --row-index: ${index}; }`).join("\n");
  return `<!doctype html>
<html data-benchmark="html-entry">
  <head>
    <style>
      :root { --benchmark-accent: rgb(27, 99, 160); font-size: 16px; }
      .benchmark-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
      .benchmark-card { color: var(--benchmark-accent); padding: 0.25rem; }
      ${rules}
    </style>
  </head>
  <body>
    <main class="benchmark-shell" data-template-node="true"></main>
    <script src="/component.js?run=${encodeURIComponent(run)}"></script>
  </body>
</html>`;
}

const script = `
(function () {
  let root;
  const listeners = [];
  window.MicroFrameBenchmarkHtml = {
    mount(props) {
      root = document.createElement('section');
      root.className = 'benchmark-grid';
      for (let index = 0; index < 48; index += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'benchmark-card';
        button.dataset.row = String(index);
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 8 8');
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '4'); circle.setAttribute('cy', '4'); circle.setAttribute('r', '3');
        icon.append(circle);
        const label = document.createElement('span');
        label.textContent = 'Component ' + index;
        const listener = () => { root.dataset.lastInteraction = String(index); };
        button.addEventListener('click', listener);
        listeners.push([button, listener]);
        button.append(icon, label);
        root.append(button);
      }
      props.container.append(root);
    },
    unmount() {
      for (const [target, listener] of listeners.splice(0)) target.removeEventListener('click', listener);
      root && root.remove();
      root = undefined;
    }
  };
})();
`;

const resourceOwnerScript = `
(function () {
  const calls = { media: 0, once: 0, aborted: 0, legacy: 0, onchange: 0, resize: 0, intersection: 0 };
  let handles;
  window.MicroFrameResourceOwner = {
    mount(props) {
      const media = matchMedia('(min-width: 1px)');
      media.addEventListener('change', () => { calls.media += 1; });
      media.addEventListener('change', () => { calls.once += 1; }, { once: true });
      const controller = new AbortController();
      media.addEventListener('change', () => { calls.aborted += 1; }, { signal: controller.signal });
      controller.abort();
      const legacy = () => { calls.legacy += 1; };
      media.addListener(legacy);
      media.onchange = () => { calls.onchange += 1; };
      const removedMedia = matchMedia('(prefers-reduced-motion: reduce)');
      const removedListener = () => { calls.media += 1000; };
      removedMedia.addEventListener('change', removedListener);
      removedMedia.removeEventListener('change', removedListener);
      const resize = new ResizeObserver(() => { calls.resize += 1; });
      resize.observe(document.body);
      const disconnectedResize = new ResizeObserver(() => { calls.resize += 1000; });
      disconnectedResize.observe(document.body);
      disconnectedResize.disconnect();
      disconnectedResize.disconnect();
      const intersection = new IntersectionObserver(() => { calls.intersection += 1; });
      intersection.observe(document.body);
      let invalidResizeRejected = false;
      let invalidIntersectionRejected = false;
      try { new ResizeObserver(null); } catch { invalidResizeRejected = true; }
      try { new IntersectionObserver(null); } catch { invalidIntersectionRejected = true; }
      handles = { calls, media, removedMedia, resize, disconnectedResize, intersection,
        resizeConstructorMatches: resize.constructor === ResizeObserver,
        intersectionConstructorMatches: intersection.constructor === IntersectionObserver,
        invalidResizeRejected, invalidIntersectionRejected };
      window.__MICRO_FRAME_RESOURCE_HANDLES__ = handles;
      const marker = document.createElement('div');
      marker.dataset.resourceOwner = 'mounted';
      props.container.append(marker);
    },
    unmount(props) { props.container.replaceChildren(); }
  };
})();
`;

const styleContractScript = `
(function () {
  window.MicroFrameStyleContract = {
    mount(props) {
      const root = document.createElement('section');
      const rem = document.createElement('div');
      rem.className = 'mfopt-rem';
      const font = document.createElement('div');
      font.className = 'mfopt-font';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const svgStyle = document.createElementNS(svg.namespaceURI, 'style');
      svgStyle.textContent = '.mfopt-svg { width: 2rem; fill: rgb(17, 85, 153); }';
      const rect = document.createElementNS(svg.namespaceURI, 'rect');
      rect.setAttribute('class', 'mfopt-svg');
      svg.append(svgStyle, rect);
      const nestedHost = document.createElement('div');
      const nestedRoot = nestedHost.attachShadow({ mode: 'open' });
      const nestedStyle = document.createElement('style');
      nestedStyle.textContent = '.mfopt-nested { width: 2rem; }';
      const nested = document.createElement('div');
      nested.className = 'mfopt-nested';
      nestedRoot.append(nestedStyle, nested);
      const overlay = document.createElement('div');
      overlay.setAttribute('role', 'dialog');
      overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh';
      overlay.append(document.createElement('button'));
      const dynamicStyle = document.createElement('style');
      document.head.append(dynamicStyle);
      dynamicStyle.sheet.insertRule('.mfopt-dynamic { height: 3rem; }', 0);
      const dynamic = document.createElement('div');
      dynamic.className = 'mfopt-dynamic';
      root.append(rem, font, svg, nestedHost, overlay, dynamic);
      props.container.append(root);
      const beforeRemoval = getComputedStyle(dynamic).height;
      dynamicStyle.remove();
      window.__MICRO_FRAME_STYLE_CONTRACT__ = {
        remWidth: getComputedStyle(rem).width,
        fontFamily: getComputedStyle(font).fontFamily,
        svgWidth: getComputedStyle(rect).width,
        svgFill: getComputedStyle(rect).fill,
        nestedWidth: getComputedStyle(nested).width,
        dynamicBeforeRemoval: beforeRemoval,
        dynamicAfterRemoval: getComputedStyle(dynamic).height,
      };
    },
    unmount(props) { props.container.replaceChildren(); }
  };
})();
`;

const failingComponentScript = `
(function () {
  window.MicroFrameFailingComponent = {
    mount(props) {
      const root = document.createElement('section');
      root.className = 'mfopt-failing-component';
      for (let index = 0; index < 24; index += 1) {
        const button = document.createElement('button');
        button.textContent = 'Failure row ' + index;
        root.append(button);
      }
      props.container.append(root);
    },
    unmount(props) {
      props.container.replaceChildren();
      throw new Error('injected component unmount failure');
    }
  };
})();
`;

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const run = url.searchParams.get("run");
  record(run, url.pathname);
  response.setHeader("Access-Control-Allow-Origin", request.headers.origin ?? "*");
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Vary", "Origin");
  response.setHeader("Cache-Control", url.pathname === "/component.html" ? "public, max-age=300" : "no-store");
  if (url.pathname === "/component.html") {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(html(run ?? "untracked"));
    return;
  }
  if (url.pathname === "/flaky.html") {
    const key = run ?? "untracked";
    const attempt = (flakyAttempts.get(key) ?? 0) + 1;
    flakyAttempts.set(key, attempt);
    if (attempt === 1) {
      response.statusCode = 503;
      response.end("retry");
      return;
    }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(html(key));
    return;
  }
  if (url.pathname === "/component.js") {
    response.setHeader("Content-Type", "text/javascript; charset=utf-8");
    response.end(script);
    return;
  }
  if (url.pathname === "/resources.html") {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<!doctype html><body><script src="/resources.js"></script></body>');
    return;
  }
  if (url.pathname === "/slow-resources.html") {
    setTimeout(() => {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end('<!doctype html><body><script src="/resources.js"></script></body>');
    }, 500);
    return;
  }
  if (url.pathname === "/resources.js") {
    response.setHeader("Content-Type", "text/javascript; charset=utf-8");
    response.end(resourceOwnerScript);
    return;
  }
  if (url.pathname === "/style-contract.html") {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(`<!doctype html><html><head><style>
      html { font-size: 20px; }
      .mfopt-rem { width: 2rem; }
      @font-face { font-family: "MFOPT Contract"; src: local("Arial"); }
      .mfopt-font { font-family: "MFOPT Contract"; }
    </style></head><body><script src="/style-contract.js"></script></body></html>`);
    return;
  }
  if (url.pathname === "/style-contract.js") {
    response.setHeader("Content-Type", "text/javascript; charset=utf-8");
    response.end(styleContractScript);
    return;
  }
  if (url.pathname === "/failing-component.html") {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(`<!doctype html><html><head><style>
      .mfopt-failing-component { display:grid; grid-template-columns:repeat(4,1fr); gap:.25rem; }
    </style></head><body><script src="/failing-component.js"></script></body></html>`);
    return;
  }
  if (url.pathname === "/failing-component.js") {
    response.setHeader("Content-Type", "text/javascript; charset=utf-8");
    response.end(failingComponentScript);
    return;
  }
  if (url.pathname === "/stats") {
    const prefix = `${run ?? ""}:`;
    const counts = Object.fromEntries([...requestCounts]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, count]) => [key.slice(prefix.length), count]));
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(counts));
    return;
  }
  response.statusCode = 404;
  response.end("Not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`HTML Entry benchmark fixture listening on http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
