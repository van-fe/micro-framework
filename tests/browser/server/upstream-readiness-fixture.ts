import type { Plugin } from "vite";

export function upstreamReadinessFixture(): Plugin {
  return { name: "upstream-readiness-fixture", configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const path = request.url?.split("?")[0];
      if (path !== "/upstream-readiness-delayed.js" && path !== "/upstream-readiness-image.svg") return next();
      const script = path.endsWith(".js");
      await new Promise((resolve) => setTimeout(resolve, script ? 250 : 450));
      response.setHeader("Content-Type", script ? "text/javascript" : "image/svg+xml");
      response.end(script ? "window.readinessOrder.push('async');" : '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="blue"/></svg>');
    });
  } };
}
