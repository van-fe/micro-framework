import { rewriteTemplateAssets } from "@micro-framework/entry-resolver";
import { describe, expect, it } from "vitest";

describe("HTML Entry asset rewriting", () => {
  it("resolves standard URL attributes, lists, SVG references, srcsets, and inline image-set", () => {
    const template = document.createElement("template");
    template.innerHTML = `
      <form action="./submit"><button formaction="../approve">Approve</button></form>
      <object data="./manual.pdf" archive="./viewer.jar ../shared.jar"></object>
      <blockquote cite="./source.html">Source</blockquote>
      <img src="./fallback.png"
        srcset="data:image/svg+xml,%3Csvg%3E 1x, ./large.png 2x">
      <link rel="preload" imagesrcset="./small.png 1x, ../wide.png 2x">
      <svg><use xlink:href="./icons.svg#check"></use></svg>
      <a class="audit" href="#local" ping="./audit ../second-audit">Audit</a>
      <a class="script-link" href="javascript:void(0)">Script</a>
      <div class="picture" style="background-image:image-set('./one.png' 1x,url(../two.png) 2x)"></div>
    `;

    rewriteTemplateAssets(template.content, "https://apps.example.com/catalog/pages/index.html");

    expect(template.content.querySelector("form")?.getAttribute("action"))
      .toBe("https://apps.example.com/catalog/pages/submit");
    expect(template.content.querySelector("button")?.getAttribute("formaction"))
      .toBe("https://apps.example.com/catalog/approve");
    expect(template.content.querySelector("object")?.getAttribute("data"))
      .toBe("https://apps.example.com/catalog/pages/manual.pdf");
    expect(template.content.querySelector("object")?.getAttribute("archive"))
      .toBe("https://apps.example.com/catalog/pages/viewer.jar https://apps.example.com/catalog/shared.jar");
    expect(template.content.querySelector("blockquote")?.getAttribute("cite"))
      .toBe("https://apps.example.com/catalog/pages/source.html");
    expect(template.content.querySelector("img")?.getAttribute("srcset"))
      .toBe("data:image/svg+xml,%3Csvg%3E 1x, https://apps.example.com/catalog/pages/large.png 2x");
    expect(template.content.querySelector("link")?.getAttribute("imagesrcset"))
      .toBe(
        "https://apps.example.com/catalog/pages/small.png 1x, "
        + "https://apps.example.com/catalog/wide.png 2x",
      );
    expect(template.content.querySelector("use")?.getAttribute("xlink:href"))
      .toBe("https://apps.example.com/catalog/pages/icons.svg#check");
    expect(template.content.querySelector(".audit")?.getAttribute("href")).toBe("#local");
    expect(template.content.querySelector(".audit")?.getAttribute("ping"))
      .toBe("https://apps.example.com/catalog/pages/audit https://apps.example.com/catalog/second-audit");
    expect(template.content.querySelector(".script-link")?.getAttribute("href")).toBe("javascript:void(0)");
    expect(template.content.querySelector(".picture")?.getAttribute("style"))
      .toBe(
        "background-image:image-set('https://apps.example.com/catalog/pages/one.png' 1x,"
        + "url(https://apps.example.com/catalog/two.png) 2x)",
      );
  });
});
