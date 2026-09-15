import type { MicroRuntime } from "@micro-framework/runtime";
import { test, expect, isolateBrowserProcess } from "./browser-process-fixture";

isolateBrowserProcess(import.meta.url);

declare global {
  interface Window {
    __batch02AssetRuntime?: MicroRuntime;
    __batch02CspViolations?: Array<{ directive: string; blocked: string }>;
  }
}

test.afterEach(async ({ page }) => {
  await page.evaluate(async () => { await window.__batch02AssetRuntime?.destroy(); delete window.__batch02AssetRuntime; });
});

test("W779 loads four then five and six real Vue images and mixed backgrounds from the application origin", async ({ page }) => {
  const wrongRequests: string[] = [];
  const pageErrors: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/batch02/pixel.svg") && new URL(request.url()).origin !== "http://127.0.0.1:5176") wrongRequests.push(request.url());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
  await page.evaluate(async () => {
    const runtime = window.__createMicroFrameBenchmarkRuntime__!();
    window.__batch02AssetRuntime = runtime;
    const container = document.body.appendChild(document.createElement("main"));
    container.id = "batch02-assets";
    await runtime.mountApp({ name: "vue-images", container, entry: { type: "module", url: "http://127.0.0.1:5176/src/upstream-batch02-assets.ts" } });
  });
  for (const count of [4, 5, 6]) {
    const images = page.locator("#batch02-assets img");
    await expect(images).toHaveCount(count);
    await expect.poll(() => images.evaluateAll((images) => images.every(image => (image as HTMLImageElement).naturalWidth === 8))).toBe(true);
    const backgrounds = await page.locator("#batch02-assets [data-asset-background]").evaluateAll((nodes) => nodes.map(node => getComputedStyle(node).backgroundImage));
    expect(backgrounds).toHaveLength(count);
    expect(backgrounds.every(url => url.includes("http://127.0.0.1:5176/batch02/pixel.svg"))).toBe(true);
    if (count < 6) await page.getByRole("button", { name: "Add image" }).click();
  }
  expect(wrongRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("W727 mounts and styles an HTML application under style-src without unsafe-inline and emits no style CSP violations", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.__batch02CspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => window.__batch02CspViolations!.push({ directive: event.effectiveDirective, blocked: event.blockedURI }));
  });
  await page.goto("/__batch02-csp-host.html");
  await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
  await page.evaluate(async () => {
    const { origin } = await (await fetch("/__batch02-entry")).json() as { origin: string };
    const runtime = window.__createMicroFrameBenchmarkRuntime__!();
    window.__batch02AssetRuntime = runtime;
    await runtime.mountApp({ name: "csp-entry", container: "#csp-slot", entry: { type: "html", url: origin + "/csp.html" } });
  });
  const button = page.getByRole("button", { name: "CSP count: 0" });
  await expect(button).toHaveCSS("color", "rgb(12, 34, 56)");
  await button.click();
  await expect(page.getByRole("button", { name: "CSP count: 1" })).toBeVisible();
  expect(await page.locator("micro-app-host").evaluate(node => getComputedStyle(node).display)).toBe("block");
  expect(await page.locator("micro-app-body").evaluate(node => getComputedStyle(node).display)).toBe("block");
  expect(await page.evaluate(() => window.__batch02CspViolations!.filter(event => event.directive.startsWith("style-src")))).toEqual([]);
  expect(errors).toEqual([]);
});

for (const allowed of [true, false]) test(`W727 respects author inline-style nonce authorization without restoring blocked CSS (nonce=${allowed})`, async ({page}) => {
  await page.addInitScript(() => {
    window.__batch02CspViolations = [];
    document.addEventListener("securitypolicyviolation", event => window.__batch02CspViolations!.push({directive:event.effectiveDirective,blocked:event.blockedURI}));
  });
  await page.goto("/__batch02-csp-nonce-host.html");
  await page.waitForFunction(() => Boolean(window.__createMicroFrameBenchmarkRuntime__));
  await page.evaluate(async allowed => {
    const {origin} = await (await fetch("/__batch02-entry")).json() as {origin:string};
    const runtime = window.__createMicroFrameBenchmarkRuntime__!(); window.__batch02AssetRuntime = runtime;
    await runtime.mountApp({name:"nonce-app",container:"#csp-slot",entry:{type:"html",url:origin+"/csp-nonce.html?allowed="+(allowed?"1":"0")}});
  }, allowed);
  const probe = page.getByRole("button",{name:"Nonce probe"});
  await expect(probe).toBeVisible();
  const token = () => page.locator("micro-app-host").evaluate(node => getComputedStyle(node).getPropertyValue("--csp-author-color").trim());
  if (allowed) {
    await expect(probe).toHaveCSS("color","rgb(70, 90, 110)"); await expect(probe).toHaveCSS("width","37px");
    expect(await token()).toBe("rgb(70, 90, 110)");
    expect(await page.evaluate(() => window.__batch02CspViolations!.filter(event => event.directive.startsWith("style-src")))).toEqual([]);
  } else {
    await expect.poll(() => page.evaluate(() => window.__batch02CspViolations!.filter(event => event.directive.startsWith("style-src") && event.blocked === "inline").length)).toBeGreaterThan(0);
    expect(await token()).toBe(""); await expect(probe).not.toHaveCSS("color","rgb(70, 90, 110)");
    expect(await page.locator("micro-app-head style").evaluate(node => (node as HTMLStyleElement).sheet)).toBeNull();
  }
  await expect(page.locator("micro-app-host")).toHaveCSS("display","block");
});
