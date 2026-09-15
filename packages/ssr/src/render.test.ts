import { describe, expect, it } from "vitest";
import { renderSsrApplication, renderSsrApplicationStream, ssrSurfaceProtocol } from "./render";

describe("SSR application surface renderer", () => {
  it("emits a deterministic Declarative Shadow DOM surface", async () => {
    const html = await renderSsrApplication({
      name: "orders",
      hydrationKey: "route:/orders",
      body: "<article>server view</article>",
      hostAttributes: { lang: "zh-CN", hidden: false, "data-micro-app": "override" },
    });
    expect(html).toContain(`<micro-app-host data-micro-app="orders" data-micro-hydration-key="route:/orders" data-micro-ssr="${ssrSurfaceProtocol}" lang="zh-CN">`);
    expect(html).toContain('<template shadowrootmode="open">');
    expect(html).toContain('<micro-app-body tabindex="-1" data-micro-app-root="orders"><article>server view</article>');
    expect(html).not.toContain("override");
  });

  it("preserves application chunks instead of buffering the body", async () => {
    async function* body() {
      yield "<h1>first</h1>";
      yield "<p>second</p>";
    }
    const chunks: string[] = [];
    for await (const chunk of renderSsrApplicationStream({
      name: "orders",
      hydrationKey: "orders-main",
      body: body(),
    })) chunks.push(chunk);
    expect(chunks).toHaveLength(4);
    expect(chunks[1]).toBe("<h1>first</h1>");
    expect(chunks[2]).toBe("<p>second</p>");
  });

  it("rejects ambiguous hydration identifiers", async () => {
    await expect(renderSsrApplication({
      name: " orders ",
      hydrationKey: "orders-main",
      body: "",
    })).rejects.toThrow("Application name must be a non-empty trimmed string");
    await expect(renderSsrApplication({
      name: "orders",
      hydrationKey: "orders-main",
      body: "",
      hostAttributes: { onclick: "steal()" },
    })).rejects.toThrow("Unsafe SSR host attribute: onclick");
  });
});
