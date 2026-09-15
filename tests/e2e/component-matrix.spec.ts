import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";

isolateBrowserProcess(import.meta.url);

declare global {
  interface Window {
    __componentMatrixHandle__?: { dispose(): Promise<void> };
    __componentMatrixRuntime__?: { destroy(): Promise<void> };
  }
}

const entry = "http://127.0.0.1:5180/src/lifecycle.ts";

test.beforeEach(async ({ page }) => {
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      console.log(`[browser:${message.type()}] ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    console.log(`[browser:pageerror] ${error.stack ?? error.message}`);
  });
});

test("runs heavy editors, maps, Workers, WebGL, and multilingual input in one isolated Realm", async ({ page }) => {
  await page.goto("/benchmark.html");
  await page.waitForFunction(() => typeof window.__createMicroFrameBenchmarkRuntime__ === "function");
  await page.evaluate(async (entryUrl) => {
    const slot = document.createElement("div");
    slot.id = "component-matrix-slot";
    document.body.append(slot);
    const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
    const handle = await runtime.mountApp({
      name: "component-matrix",
      entry: { url: entryUrl, type: "module" },
      container: slot,
    });
    window.__componentMatrixRuntime__ = runtime;
    window.__componentMatrixHandle__ = handle;
  }, entry);

  const root = page.locator("#component-matrix-slot .component-matrix");
  await expect(root).toHaveAttribute("data-ready", "true");

  const editor = root.locator(".ql-editor");
  await expect(root.locator(".ql-toolbar")).toBeVisible();
  await expect(editor).toHaveAttribute("contenteditable", "true");
  await editor.click();
  await editor.press("ControlOrMeta+A");
  await page.keyboard.insertText("Edited in a real browser");
  await expect(root).toHaveAttribute("data-editor-text", "Edited in a real browser");
  await editor.press("ControlOrMeta+A");
  await root.locator(".ql-bold").click();
  await expect(editor.locator("strong")).toContainText("Edited in a real browser");

  const monacoEditor = root.locator(".matrix-monaco .monaco-editor");
  await expect(monacoEditor).toBeVisible();
  await monacoEditor.scrollIntoViewIfNeeded();
  await monacoEditor.locator(".view-lines").click({ position: { x: 80, y: 24 } });
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("\n// browser edit");
  await expect(root).toHaveAttribute("data-monaco-value", /browser edit/);
  await expect.poll(async () => Number(await root.getAttribute("data-monaco-markers"))).toBeGreaterThan(0);

  await expect(root.locator(".matrix-chart svg")).toBeVisible();
  expect(await root.locator(".matrix-chart svg path").count()).toBeGreaterThan(2);
  await root.locator(".matrix-chart-update").click();
  await expect(root).toHaveAttribute("data-chart-updated", "true");

  await expect(root.locator(".matrix-map")).toBeVisible();
  await expect(root.locator(".leaflet-map-pane")).toHaveCount(1);
  await expect(root.locator(".leaflet-popup-content")).toHaveText("Realm map marker");
  expect(await root.locator(".leaflet-overlay-pane svg path").count()).toBe(1);
  await root.locator(".matrix-map-pan").click();
  await expect(root).toHaveAttribute("data-map-moved", "true");

  await expect(root).toHaveAttribute("data-maplibre-ready", "true", { timeout: 10_000 });
  expect(Number(await root.getAttribute("data-maplibre-features"))).toBeGreaterThan(0);
  const mapLibreCanvas = root.locator(".matrix-maplibre canvas.maplibregl-canvas");
  await expect(mapLibreCanvas).toBeVisible();
  const mapLibrePixel = await mapLibreCanvas.evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!context) return [];
    const pixel = new Uint8Array(4);
    context.readPixels(
      Math.floor(context.drawingBufferWidth / 2),
      Math.floor(context.drawingBufferHeight / 2),
      1,
      1,
      context.RGBA,
      context.UNSIGNED_BYTE,
      pixel,
    );
    return [...pixel];
  });
  expect(mapLibrePixel).toHaveLength(4);
  expect(mapLibrePixel[3]).toBe(255);
  await root.locator(".matrix-maplibre-jump").click();
  await expect(root).toHaveAttribute("data-maplibre-moved", "true");

  await expect(root).toHaveAttribute("data-three-ready", "true");
  await expect(root.locator(".matrix-three-canvas")).toBeVisible();
  expect(Number(await root.getAttribute("data-three-objects"))).toBeGreaterThanOrEqual(3);
  expect(Number(await root.getAttribute("data-three-programs"))).toBeGreaterThan(0);
  const threePixel = (await root.getAttribute("data-three-pixel"))!.split(",").map(Number);
  expect(threePixel).toHaveLength(4);
  const [threeRed, threeGreen, threeBlue, threeAlpha] = threePixel as [number, number, number, number];
  expect(threeRed + threeGreen + threeBlue).toBeGreaterThan(40);
  expect(threeAlpha).toBe(255);
  await root.locator(".matrix-three-rotate").click();
  await expect(root).toHaveAttribute("data-three-rotated", "true");

  await expect(root).toHaveAttribute("data-worker-result", "10:module");
  const webglPixel = await root.getAttribute("data-webgl-pixel");
  expect(webglPixel).not.toBe("unavailable");
  const [red, green, blue, alpha] = webglPixel!.split(",").map(Number);
  expect(red).toBeGreaterThanOrEqual(24);
  expect(red).toBeLessThanOrEqual(27);
  expect(green).toBeGreaterThanOrEqual(152);
  expect(green).toBeLessThanOrEqual(154);
  expect(blue).toBeGreaterThanOrEqual(75);
  expect(blue).toBeLessThanOrEqual(78);
  expect(alpha).toBe(255);

  const multilingualInput = root.getByLabel("Multilingual editor probe");
  await multilingualInput.click();
  await page.keyboard.insertText("中文输入");
  await expect(root).toHaveAttribute("data-text-input", "中文输入");
  expect(["insertText", "insertCompositionText"]).toContain(
    await root.getAttribute("data-before-input"),
  );
  await multilingualInput.evaluate((element) => {
    const CompositionEventConstructor = element.ownerDocument.defaultView!.CompositionEvent;
    element.dispatchEvent(new CompositionEventConstructor("compositionstart", {
      bubbles: true,
      composed: true,
      data: "中",
    }));
    element.dispatchEvent(new CompositionEventConstructor("compositionend", {
      bubbles: true,
      composed: true,
      data: "中文",
    }));
  });
  await expect(root).toHaveAttribute("data-composition", "end:中文");

  expect(await page.evaluate(() => {
    const host = document.querySelector("#component-matrix-slot micro-app-host");
    const frame = host?.querySelector("iframe");
    return {
      hostQueryEscaped: document.querySelector(".ql-editor") !== null,
      realmQueryFindsEditor: frame?.contentDocument?.querySelector(".ql-editor") !== null,
      shadowOwnsEditor: host?.shadowRoot?.querySelector(".ql-editor") !== null,
      hostQueryFindsMonaco: document.querySelector(".monaco-editor") !== null,
      realmQueryFindsMonaco: frame?.contentDocument?.querySelector(".monaco-editor") !== null,
      shadowOwnsMonaco: host?.shadowRoot?.querySelector(".monaco-editor") !== null,
      hostQueryFindsMapLibre: document.querySelector(".maplibregl-canvas") !== null,
      realmQueryFindsMapLibre: frame?.contentDocument?.querySelector(".maplibregl-canvas") !== null,
      shadowOwnsMapLibre: host?.shadowRoot?.querySelector(".maplibregl-canvas") !== null,
      hostQueryFindsThree: document.querySelector(".matrix-three-canvas") !== null,
      realmQueryFindsThree: frame?.contentDocument?.querySelector(".matrix-three-canvas") !== null,
      shadowOwnsThree: host?.shadowRoot?.querySelector(".matrix-three-canvas") !== null,
    };
  })).toEqual({
    hostQueryEscaped: false,
    realmQueryFindsEditor: true,
    shadowOwnsEditor: true,
    hostQueryFindsMonaco: false,
    realmQueryFindsMonaco: true,
    shadowOwnsMonaco: true,
    hostQueryFindsMapLibre: false,
    realmQueryFindsMapLibre: true,
    shadowOwnsMapLibre: true,
    hostQueryFindsThree: false,
    realmQueryFindsThree: true,
    shadowOwnsThree: true,
  });

  await page.evaluate(async () => {
    await window.__componentMatrixHandle__?.dispose();
    await window.__componentMatrixRuntime__?.destroy();
  });
  await expect(page.locator("#component-matrix-slot iframe")).toHaveCount(0);
  await expect(page.locator("#component-matrix-slot micro-app-host")).toHaveCount(0);
});
