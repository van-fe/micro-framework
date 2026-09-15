import {
  ServerApplicationRegistry,
  readServerRuntimeBootstrap,
  renderServerRegistryScripts,
} from "@micro-framework/server-registry";
import { afterEach, describe, expect, it } from "vitest";

const frames = new Set<HTMLIFrameElement>();

afterEach(() => {
  for (const frame of frames) frame.remove();
  frames.clear();
});

describe("server registry browser bootstrap", () => {
  it("installs a native Import Map before modules and parses server registrations", async () => {
    const registry = new ServerApplicationRegistry();
    registry.register([{
      name: "server-orders",
      entry: "/orders-entry.js",
      container: "#orders",
      activeWhen: "/orders",
    }]);
    const scripts = renderServerRegistryScripts(registry.createBootstrap(), {
      importMap: { imports: { "server-marker": "/server-registry-marker.js" } },
    });
    const frame = document.createElement("iframe");
    document.body.append(frame);
    frames.add(frame);
    const frameDocument = frame.contentDocument!;
    frameDocument.open();
    frameDocument.write(`<!doctype html><html><body>${scripts}<script type="module">
      import { serverRegistryMarker } from "server-marker";
      window.__serverRegistryMarker = serverRegistryMarker;
    <\/script></body></html>`);
    frameDocument.close();
    const frameWindow = frame.contentWindow as Window & { __serverRegistryMarker?: string };
    await expect.poll(() => frameWindow.__serverRegistryMarker).toBe("native-import-map-resolved");
    expect(readServerRuntimeBootstrap(frameDocument).applications).toEqual([{
      name: "server-orders",
      entry: "/orders-entry.js",
      container: "#orders",
      activeWhen: "/orders",
    }]);
  });
});
