# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: component-matrix.spec.ts >> runs heavy editors, maps, Workers, WebGL, and multilingual input in one isolated Realm
- Location: tests/e2e/component-matrix.spec.ts:25:1

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - main
  - generic [ref=e4]:
    - main [ref=e5]:
      - generic [ref=e6]:
        - heading "Quill rich text" [level=2] [ref=e7]
        - generic [ref=e8]:
          - toolbar [ref=e9]:
            - generic [ref=e10]:
              - button "bold" [ref=e11] [cursor=pointer]
              - button "italic" [ref=e15] [cursor=pointer]
            - generic [ref=e21]:
              - button "Normal" [ref=e22] [cursor=pointer]
              - text: Heading 1 Heading 2 Normal
          - generic [ref=e26]:
            - paragraph [ref=e28]:
              - strong [ref=e29]: Edited in a real browser
            - text: "Visit URL: EditRemove"
      - generic [ref=e30]:
        - heading "Monaco JSON editor + language Worker" [level=2] [ref=e31]
        - code [ref=e34]:
          - generic [ref=e35]:
            - textbox "Monaco JSON editor probe": "{ \"realm\": // browser edit true }"
            - generic [ref=e37]:
              - generic [ref=e38]: "1"
              - generic [ref=e40]: "2"
              - generic [ref=e42]: "3"
              - generic [ref=e44]: "4"
              - generic [ref=e47]: "5"
            - generic [ref=e58]:
              - generic [ref=e59]: "{"
              - generic [ref=e61]: "\"realm\":"
              - generic [ref=e64]: // browser edit true
              - generic [ref=e66]: "}"
      - generic [ref=e69]:
        - heading "Apache ECharts SVG" [level=2] [ref=e70]
        - img [ref=e74]:
          - generic [ref=e76]: 0510152025ABC
        - button "Update chart" [ref=e87] [cursor=pointer]
      - generic [ref=e88]:
        - heading "Leaflet vector map" [level=2] [ref=e89]
        - generic [ref=e91]:
          - generic:
            - generic:
              - img:
                - generic [ref=e92] [cursor=pointer]
            - generic [ref=e93]:
              - generic [ref=e94]: Realm map marker
              - button "Close popup" [ref=e97] [cursor=pointer]: ×
          - generic [ref=e98]:
            - button "Zoom in" [ref=e99] [cursor=pointer]: +
            - button "Zoom out" [ref=e100] [cursor=pointer]: −
        - button "Pan map" [ref=e101] [cursor=pointer]
      - generic [ref=e102]:
        - heading "MapLibre GL local GeoJSON" [level=2] [ref=e103]
        - region "Map" [ref=e106]
        - button "Jump WebGL map" [ref=e107] [cursor=pointer]
      - generic [ref=e108]:
        - heading "Three.js scene graph + shader" [level=2] [ref=e109]
        - button "Rotate 3D scene" [ref=e112] [cursor=pointer]
      - generic [ref=e113]:
        - heading "Worker, WebGL, and text input" [level=2] [ref=e114]
        - textbox "Multilingual editor probe" [ref=e116]
    - generic [ref=e118]:
      - alert
      - alert
```

# Test source

```ts
  1   | import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";
  2   | 
  3   | isolateBrowserProcess(import.meta.url);
  4   | 
  5   | declare global {
  6   |   interface Window {
  7   |     __componentMatrixHandle__?: { dispose(): Promise<void> };
  8   |     __componentMatrixRuntime__?: { destroy(): Promise<void> };
  9   |   }
  10  | }
  11  | 
  12  | const entry = "http://127.0.0.1:5180/src/lifecycle.ts";
  13  | 
  14  | test.beforeEach(async ({ page }) => {
  15  |   page.on("console", (message) => {
  16  |     if (message.type() === "error" || message.type() === "warning") {
  17  |       console.log(`[browser:${message.type()}] ${message.text()}`);
  18  |     }
  19  |   });
  20  |   page.on("pageerror", (error) => {
  21  |     console.log(`[browser:pageerror] ${error.stack ?? error.message}`);
  22  |   });
  23  | });
  24  | 
  25  | test("runs heavy editors, maps, Workers, WebGL, and multilingual input in one isolated Realm", async ({ page }) => {
  26  |   await page.goto("/benchmark.html");
  27  |   await page.waitForFunction(() => typeof window.__createMicroFrameBenchmarkRuntime__ === "function");
  28  |   await page.evaluate(async (entryUrl) => {
  29  |     const slot = document.createElement("div");
  30  |     slot.id = "component-matrix-slot";
  31  |     document.body.append(slot);
  32  |     const runtime = window.__createMicroFrameBenchmarkRuntime__!({ storage: { persistent: false } });
  33  |     const handle = await runtime.mountApp({
  34  |       name: "component-matrix",
  35  |       entry: { url: entryUrl, type: "module" },
  36  |       container: slot,
  37  |     });
  38  |     window.__componentMatrixRuntime__ = runtime;
  39  |     window.__componentMatrixHandle__ = handle;
  40  |   }, entry);
  41  | 
  42  |   const root = page.locator("#component-matrix-slot .component-matrix");
  43  |   await expect(root).toHaveAttribute("data-ready", "true");
  44  | 
  45  |   const editor = root.locator(".ql-editor");
  46  |   await expect(root.locator(".ql-toolbar")).toBeVisible();
  47  |   await expect(editor).toHaveAttribute("contenteditable", "true");
  48  |   await editor.click();
  49  |   await editor.press("ControlOrMeta+A");
  50  |   await page.keyboard.insertText("Edited in a real browser");
  51  |   await expect(root).toHaveAttribute("data-editor-text", "Edited in a real browser");
  52  |   await editor.press("ControlOrMeta+A");
  53  |   await root.locator(".ql-bold").click();
  54  |   await expect(editor.locator("strong")).toContainText("Edited in a real browser");
  55  | 
  56  |   const monacoEditor = root.locator(".matrix-monaco .monaco-editor");
  57  |   await expect(monacoEditor).toBeVisible();
  58  |   await monacoEditor.scrollIntoViewIfNeeded();
  59  |   await monacoEditor.locator(".view-lines").click({ position: { x: 80, y: 24 } });
  60  |   await page.keyboard.press("ControlOrMeta+End");
  61  |   await page.keyboard.insertText("\n// browser edit");
  62  |   await expect(root).toHaveAttribute("data-monaco-value", /browser edit/);
> 63  |   await expect.poll(async () => Number(await root.getAttribute("data-monaco-markers"))).toBeGreaterThan(0);
      |                                                                                         ^ Error: expect(received).toBeGreaterThan(expected)
  64  | 
  65  |   await expect(root.locator(".matrix-chart svg")).toBeVisible();
  66  |   expect(await root.locator(".matrix-chart svg path").count()).toBeGreaterThan(2);
  67  |   await root.locator(".matrix-chart-update").click();
  68  |   await expect(root).toHaveAttribute("data-chart-updated", "true");
  69  | 
  70  |   await expect(root.locator(".matrix-map")).toBeVisible();
  71  |   await expect(root.locator(".leaflet-map-pane")).toHaveCount(1);
  72  |   await expect(root.locator(".leaflet-popup-content")).toHaveText("Realm map marker");
  73  |   expect(await root.locator(".leaflet-overlay-pane svg path").count()).toBe(1);
  74  |   await root.locator(".matrix-map-pan").click();
  75  |   await expect(root).toHaveAttribute("data-map-moved", "true");
  76  | 
  77  |   await expect(root).toHaveAttribute("data-maplibre-ready", "true", { timeout: 10_000 });
  78  |   expect(Number(await root.getAttribute("data-maplibre-features"))).toBeGreaterThan(0);
  79  |   const mapLibreCanvas = root.locator(".matrix-maplibre canvas.maplibregl-canvas");
  80  |   await expect(mapLibreCanvas).toBeVisible();
  81  |   const mapLibrePixel = await mapLibreCanvas.evaluate((canvas: HTMLCanvasElement) => {
  82  |     const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  83  |     if (!context) return [];
  84  |     const pixel = new Uint8Array(4);
  85  |     context.readPixels(
  86  |       Math.floor(context.drawingBufferWidth / 2),
  87  |       Math.floor(context.drawingBufferHeight / 2),
  88  |       1,
  89  |       1,
  90  |       context.RGBA,
  91  |       context.UNSIGNED_BYTE,
  92  |       pixel,
  93  |     );
  94  |     return [...pixel];
  95  |   });
  96  |   expect(mapLibrePixel).toHaveLength(4);
  97  |   expect(mapLibrePixel[3]).toBe(255);
  98  |   await root.locator(".matrix-maplibre-jump").click();
  99  |   await expect(root).toHaveAttribute("data-maplibre-moved", "true");
  100 | 
  101 |   await expect(root).toHaveAttribute("data-three-ready", "true");
  102 |   await expect(root.locator(".matrix-three-canvas")).toBeVisible();
  103 |   expect(Number(await root.getAttribute("data-three-objects"))).toBeGreaterThanOrEqual(3);
  104 |   expect(Number(await root.getAttribute("data-three-programs"))).toBeGreaterThan(0);
  105 |   const threePixel = (await root.getAttribute("data-three-pixel"))!.split(",").map(Number);
  106 |   expect(threePixel).toHaveLength(4);
  107 |   const [threeRed, threeGreen, threeBlue, threeAlpha] = threePixel as [number, number, number, number];
  108 |   expect(threeRed + threeGreen + threeBlue).toBeGreaterThan(40);
  109 |   expect(threeAlpha).toBe(255);
  110 |   await root.locator(".matrix-three-rotate").click();
  111 |   await expect(root).toHaveAttribute("data-three-rotated", "true");
  112 | 
  113 |   await expect(root).toHaveAttribute("data-worker-result", "10:module");
  114 |   const webglPixel = await root.getAttribute("data-webgl-pixel");
  115 |   expect(webglPixel).not.toBe("unavailable");
  116 |   const [red, green, blue, alpha] = webglPixel!.split(",").map(Number);
  117 |   expect(red).toBeGreaterThanOrEqual(24);
  118 |   expect(red).toBeLessThanOrEqual(27);
  119 |   expect(green).toBeGreaterThanOrEqual(152);
  120 |   expect(green).toBeLessThanOrEqual(154);
  121 |   expect(blue).toBeGreaterThanOrEqual(75);
  122 |   expect(blue).toBeLessThanOrEqual(78);
  123 |   expect(alpha).toBe(255);
  124 | 
  125 |   const multilingualInput = root.getByLabel("Multilingual editor probe");
  126 |   await multilingualInput.click();
  127 |   await page.keyboard.insertText("中文输入");
  128 |   await expect(root).toHaveAttribute("data-text-input", "中文输入");
  129 |   expect(["insertText", "insertCompositionText"]).toContain(
  130 |     await root.getAttribute("data-before-input"),
  131 |   );
  132 |   await multilingualInput.evaluate((element) => {
  133 |     const CompositionEventConstructor = element.ownerDocument.defaultView!.CompositionEvent;
  134 |     element.dispatchEvent(new CompositionEventConstructor("compositionstart", {
  135 |       bubbles: true,
  136 |       composed: true,
  137 |       data: "中",
  138 |     }));
  139 |     element.dispatchEvent(new CompositionEventConstructor("compositionend", {
  140 |       bubbles: true,
  141 |       composed: true,
  142 |       data: "中文",
  143 |     }));
  144 |   });
  145 |   await expect(root).toHaveAttribute("data-composition", "end:中文");
  146 | 
  147 |   expect(await page.evaluate(() => {
  148 |     const host = document.querySelector("#component-matrix-slot micro-app-host");
  149 |     const frame = host?.querySelector("iframe");
  150 |     return {
  151 |       hostQueryEscaped: document.querySelector(".ql-editor") !== null,
  152 |       realmQueryFindsEditor: frame?.contentDocument?.querySelector(".ql-editor") !== null,
  153 |       shadowOwnsEditor: host?.shadowRoot?.querySelector(".ql-editor") !== null,
  154 |       hostQueryFindsMonaco: document.querySelector(".monaco-editor") !== null,
  155 |       realmQueryFindsMonaco: frame?.contentDocument?.querySelector(".monaco-editor") !== null,
  156 |       shadowOwnsMonaco: host?.shadowRoot?.querySelector(".monaco-editor") !== null,
  157 |       hostQueryFindsMapLibre: document.querySelector(".maplibregl-canvas") !== null,
  158 |       realmQueryFindsMapLibre: frame?.contentDocument?.querySelector(".maplibregl-canvas") !== null,
  159 |       shadowOwnsMapLibre: host?.shadowRoot?.querySelector(".maplibregl-canvas") !== null,
  160 |       hostQueryFindsThree: document.querySelector(".matrix-three-canvas") !== null,
  161 |       realmQueryFindsThree: frame?.contentDocument?.querySelector(".matrix-three-canvas") !== null,
  162 |       shadowOwnsThree: host?.shadowRoot?.querySelector(".matrix-three-canvas") !== null,
  163 |     };
```