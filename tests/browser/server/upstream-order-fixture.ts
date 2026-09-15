import type { Plugin } from 'vite';

/** Network latency belongs in the HTTP fixture, not in application script execution. */
export function upstreamOrderFixture(): Plugin {
  return {
    name: 'upstream-order-fixture',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const name = /^\/upstream-order-([abc])\.js\?/.exec(request.url ?? '')?.[1];
        if (!name) return next();
        setTimeout(next, name === 'a' ? 600 : name === 'b' ? 300 : 0);
      });
    },
  };
}
