import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";
import { assertRealmOwnership, destroyComponent, mountComponent } from "./upstream-components-fixture";

isolateBrowserProcess(import.meta.url);

let errors: string[];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => { await destroyComponent(page); expect(errors).toEqual([]); });

test("W67 X6 Dnd follows the pointer in an offset scrolled and scaled host", async ({ page }) => {
  await mountComponent(page, "x6");
  const root = page.locator(".upstream-x6");
  for (const [index, scale] of [1, 0.85].entries()) {
    await page.locator("#upstream-components-slot").evaluate((element, scale) => {
      element.style.transform = `scale(${scale})`;
    }, scale);
    const palette = await root.locator(".upstream-x6-palette").boundingBox();
    const canvas = await root.locator(".upstream-x6-canvas").boundingBox();
    if (!palette || !canvas) throw new Error("Missing X6 geometry.");
    const drop = { x: canvas.x + canvas.width * 0.55, y: canvas.y + canvas.height * 0.55 };
    await page.mouse.move(palette.x + palette.width / 2, palette.y + palette.height / 2);
    await page.mouse.down();
    await page.mouse.move(drop.x, drop.y, { steps: 20 });
    const preview = page.locator(".x6-widget-dnd .x6-node");
    await expect(preview).toBeVisible();
    const previewBox = await preview.boundingBox();
    if (!previewBox) throw new Error("Missing X6 drag preview.");
    const geometry = JSON.stringify({ scale, drop, previewBox });
    expect(Math.abs(previewBox.x + previewBox.width / 2 - drop.x), geometry).toBeLessThan(3);
    expect(Math.abs(previewBox.y + previewBox.height / 2 - drop.y), geometry).toBeLessThan(3);
    await page.mouse.up();
    await expect(root).toHaveAttribute("data-nodes", String(index + 1));
    const placed = root.locator(".upstream-x6-canvas .x6-node").last();
    const placedBox = await placed.boundingBox();
    if (!placedBox) throw new Error("Missing dropped X6 node.");
    // X6 snaps the dropped model to its grid even when grid lines are hidden.
    const snapTolerance = Number(await root.getAttribute("data-grid-size")) * scale / 2 + 1;
    expect(Math.abs(placedBox.x + placedBox.width / 2 - drop.x)).toBeLessThan(snapTolerance);
    expect(Math.abs(placedBox.y + placedBox.height / 2 - drop.y)).toBeLessThan(snapTolerance);
  }
  await assertRealmOwnership(page, ".upstream-x6-canvas .x6-node");
});

test("W832 Vue2 host and child insert bpmn-js flow nodes in the visible ShadowRoot", async ({ page }) => {
  await mountComponent(page, "bpmn");
  await expect(page.locator(".upstream-vue2-host")).toBeVisible();
  const root = page.locator(".upstream-bpmn");
  await expect(root).toHaveAttribute("data-bpmn-elements", "5");
  await expect(root.locator('[data-element-id="Task_1"] .djs-visual rect')).toBeVisible();
  await expect(root.locator('[data-element-id="Start_1"] .djs-visual circle')).toBeVisible();
  const flow = root.locator('[data-element-id="Flow_1"] .djs-visual path');
  await expect(flow).toBeAttached();
  // A horizontal SVG path has zero geometric height despite its painted stroke.
  expect(await flow.evaluate((node: SVGPathElement) => ({
    length: node.getTotalLength(),
    stroke: getComputedStyle(node).stroke,
    strokeWidth: parseFloat(getComputedStyle(node).strokeWidth),
  }))).toEqual({ length: 104, stroke: "rgb(0, 0, 0)", strokeWidth: 2 });
  await expect(root.locator('[data-element-id="Task_1"]')).toContainText("Review request");
  await assertRealmOwnership(page, ".upstream-bpmn-canvas svg");
});

test("W288 Monaco places a caret by mouse in existing middle code before inserting text", async ({ page }) => {
  await mountComponent(page, "monaco");
  const root = page.locator(".upstream-monaco");
  const secondLine = root.locator(".view-lines .view-line").nth(1);
  await expect(secondLine).toHaveText("const middle = 2;");
  const box = await secondLine.boundingBox();
  if (!box) throw new Error("Missing Monaco line geometry.");
  await page.mouse.click(box.x + 62, box.y + box.height / 2);
  await expect(root).toHaveAttribute("data-mouse-line", "2");
  await expect(root).toHaveAttribute("data-cursor-line", "2");
  const column = Number(await root.getAttribute("data-cursor-column"));
  expect(column).toBeGreaterThan(1);
  expect(column).toBeLessThan(17);
  await page.keyboard.insertText("MOUSE");
  const middle = "const middle = 2;";
  const expected = `const first = 1;\n${middle.slice(0, column - 1)}MOUSE${middle.slice(column - 1)}\nconst last = 3;`;
  await expect(root).toHaveAttribute("data-editor-value", expected);
  await assertRealmOwnership(page, ".upstream-monaco-editor .monaco-editor");
});
