import { describe, expect, it } from "vitest";
import { rewriteSrcset } from "./asset-rewriter";
import { rewriteCssUrls } from "./index";

describe("rewriteCssUrls", () => {
  it("resolves relative CSS assets without changing absolute or data URLs", () => {
    const css = [
      "a{background:url(../images/a.png)}",
      "b{background:url('https://cdn.example.com/b.png')}",
      "c{background:url(data:image/png;base64,abc)}",
    ].join("");
    expect(rewriteCssUrls(css, "https://example.com/apps/orders/css/app.css")).toBe(
      "a{background:url(https://example.com/apps/orders/images/a.png)}" +
        "b{background:url('https://cdn.example.com/b.png')}" +
        "c{background:url(data:image/png;base64,abc)}",
    );
  });

  it("rewrites string and url candidates in standard image-set functions", () => {
    expect(rewriteCssUrls(
      `a{background:image-set("../a.png" 1x,url(../b.png) 2x,type("image/avif"))}`
      + `b{background:-webkit-image-set('icons/c.png' 1x)}`
      + `c{content:"url(../not-an-asset.png)"}`,
      "https://example.com/apps/orders/css/app.css",
    )).toBe(
      `a{background:image-set("https://example.com/apps/orders/a.png" 1x,`
      + `url(https://example.com/apps/orders/b.png) 2x,type("image/avif"))}`
      + `b{background:-webkit-image-set('https://example.com/apps/orders/css/icons/c.png' 1x)}`
      + `c{content:"url(../not-an-asset.png)"}`,
    );
  });
});

describe("rewriteSrcset", () => {
  it("preserves data URL commas while resolving relative candidates and descriptors", () => {
    expect(rewriteSrcset(
      "data:image/svg+xml,%3Csvg%3E 1x, ../img/large.png 2x, https://cdn.example/x.png 3x",
      "https://example.com/apps/orders/css/app.css",
    )).toBe(
      "data:image/svg+xml,%3Csvg%3E 1x, "
      + "https://example.com/apps/orders/img/large.png 2x, "
      + "https://cdn.example/x.png 3x",
    );
  });

  it("handles descriptor-free candidates separated by trailing commas", () => {
    expect(rewriteSrcset(
      "../small.png, ../medium.png 640w, ../large.png 1280w",
      "https://example.com/apps/orders/index.html",
    )).toBe(
      "https://example.com/apps/small.png, "
      + "https://example.com/apps/medium.png 640w, "
      + "https://example.com/apps/large.png 1280w",
    );
  });
});
