import { describe, expect, it, vi } from "vitest";
import {
  ServerApplicationRegistry,
  registerServerApplications,
  renderServerRegistryScripts,
  serverRegistryProtocol,
} from "./server-registry";

describe("ServerApplicationRegistry", () => {
  it("returns deterministic route-aware application snapshots", () => {
    const registry = new ServerApplicationRegistry();
    registry.register([
      { name: "profile", entry: "https://apps.example.com/profile.js", container: "#profile", activeWhen: "/profile" },
      { name: "orders", entry: "https://apps.example.com/orders.js", container: "#orders", activeWhen: "/orders" },
    ]);
    expect(registry.snapshot().map(({ name }) => name)).toEqual(["orders", "profile"]);
    expect(registry.snapshot("/orders/42").map(({ name }) => name)).toEqual(["orders"]);
    expect(() => registry.register([
      { name: "orders", entry: "/duplicate.js", container: "#orders" },
    ])).toThrow("already registered");
  });

  it("renders a CSP nonce, native Import Map, and script-safe JSON bootstrap", () => {
    const registry = new ServerApplicationRegistry();
    registry.register([{ name: "orders", entry: "/entry.js", container: "#orders", props: { title: "</script>" } }]);
    const html = renderServerRegistryScripts(registry.createBootstrap(), {
      nonce: "release-1",
      importMap: { imports: { "server-marker": "/server-registry-marker.js" } },
    });
    expect(html).toContain('<script type="importmap" nonce="release-1">');
    expect(html).toContain('data-micro-frame-server-registry nonce="release-1"');
    expect(html).toContain("\\u003c/script>");
    expect(html).not.toContain("</script>\"");
  });

  it("rejects unserializable server registrations", () => {
    const registry = new ServerApplicationRegistry();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => registry.register([{
      name: "orders",
      entry: "/entry.js",
      container: "#orders",
      props: circular,
    }])).toThrow("Application orders is not JSON serializable");
  });

  it("registers parsed server applications through the Runtime port", () => {
    const registerApps = vi.fn();
    const bootstrap = {
      protocol: serverRegistryProtocol,
      applications: [{ name: "orders", entry: "/entry.js", container: "#orders" }],
    } as const;
    registerServerApplications({ registerApps }, bootstrap);
    expect(registerApps).toHaveBeenCalledWith(bootstrap.applications);
  });
});
