import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium, firefox, webkit } from "@playwright/test";

// Native-browser control: no framework imports, patched DOM APIs, or application runtime.
const font = await readFile(new URL("../tests/browser/fixtures/upstream-batch02-font-normal.ttf", import.meta.url));
const server = createServer((request, response) => {
  if (request.url === "/font.ttf") { response.setHeader("Content-Type", "font/ttf"); response.end(font); }
  else if (request.url === "/font.css") {response.setHeader("Content-Type", "text/css");response.end('@font-face{font-family:"NativeOriginal";src:url("/font.ttf")} .probe{font:20px "NativeAlias";display:inline-block}');}
  else { response.setHeader("Content-Type", "text/html"); response.end("<!doctype html><html><body></body></html>"); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
try {
  for (const [name, engine] of Object.entries({chromium, firefox, webkit})) {
    if (process.argv[2] && process.argv[2] !== name) continue;
    const browser = await engine.launch();
    try {
      for (const mode of ["connected", "media-held", "link-held", "link-sheet-media", "link-managed", "style-managed", "prepared", "programmatic-only"]) {
        const page = await browser.newPage(); await page.goto(url);
        const result = await page.evaluate(async mode => {
          const original = "NativeOriginal", alias = "NativeAlias";
          const snapshot = () => [...document.fonts].map(face => ({family:face.family,status:face.status}));
          const collision = document.createElement("span"); collision.textContent="\ue6cf";
          collision.style.cssText=`font:20px "${original}";display:inline-block`;
          document.body.append(collision); const before=collision.getBoundingClientRect().width;
          const host = document.createElement("div"); document.body.append(host); const root=host.attachShadow({mode:"open"});
          const isLink=mode.startsWith("link-");
          const style=document.createElement(isLink ? "link" : "style");
          const source = family => `@font-face {font-family:"${family}";src:url("/font.ttf")} .probe {font:20px "${alias}";display:inline-block}`;
          if (mode === "media-held" || mode === "style-managed" || isLink) style.media="not all";
          if (isLink) {style.rel="stylesheet";style.href="/font.css";}
          else if (mode === "prepared") {
            const detached=new CSSStyleSheet(); detached.replaceSync(source(original));
            detached.insertRule(`@font-face {font-family:"${alias}";src:url("/font.ttf")}`,0); detached.deleteRule(1);
            style.textContent=[...detached.cssRules].map(rule=>rule.cssText).join("\n");
          } else style.textContent=mode === "programmatic-only" ? `.probe {font:20px "${alias}";display:inline-block}` : source(original);
          const loading=isLink ? new Promise(resolve=>style.onload=resolve) : Promise.resolve();
          root.append(style);await loading;
          const parsed=snapshot();
          if (mode === "connected" || mode === "media-held" || mode === "style-managed" || isLink) {
            const face=`@font-face {font-family:"${alias}";src:url("/font.ttf")}`;
            style.sheet.insertRule(mode.endsWith("managed") ? `@media not all {${face}}` : face,0); style.sheet.deleteRule(1);
          }
          const manual=new FontFace(alias,'url("/font.ttf")'); document.fonts.add(manual);
          if (mode === "link-sheet-media" || mode === "link-managed") style.sheet.media.mediaText="";
          else style.media="";
          const probe=document.createElement("span");probe.className="probe";probe.textContent="\ue6cf";root.append(probe);
          const loaded=await document.fonts.load(`20px "${alias}"`,"\ue6cf");
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          const active={loaded:loaded.length,fonts:snapshot(),width:probe.getBoundingClientRect().width,hostWidth:collision.getBoundingClientRect().width,css:[...style.sheet.cssRules].map(rule=>rule.cssText),media:style.media,sheetMedia:style.sheet.media.mediaText};
          style.media="not all";style.textContent="";document.fonts.delete(manual);host.remove();
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          return {mode,before,parsed,active,after:snapshot()};
        },mode);
        console.log(JSON.stringify({browser:name,...result})); await page.close();
      }
    } finally {await browser.close();}
  }
} finally {await new Promise(resolve=>server.close(resolve));}
