import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";
import { destroyBatch02, expectNestedRealms, mountBatch02 } from "./upstream-batch02-components-fixture";

isolateBrowserProcess(import.meta.url);
let errors: string[];
test.beforeEach(({ page }) => { errors = []; page.on("pageerror", (error) => errors.push(error.message)); });
test.afterEach(async ({ page }) => { await destroyBatch02(page); expect(errors).toEqual([]); });

test("W697 SortableJS sorts a grandchild application's list using a real mouse drag", async ({ page }) => {
  await mountBatch02(page, "sortable", { nested: true });
  await expectNestedRealms(page);
  const root = page.locator(".batch02-sortable");
  const first = root.getByText("Alpha", { exact: true });
  const target = root.getByText("Gamma", { exact: true });
  await first.dragTo(target, { targetPosition: { x: 120, y: 50 } });
  await expect(root).toHaveAttribute("data-order", "Beta,Gamma,Alpha,Delta");
  await expect(root).toHaveAttribute("data-ends", "1");
  await expect(root).toHaveAttribute("data-indices", "0,2");
});

test("Q1116 Monaco places the caret after parent and editor scrolling in a nested application", async ({ page }) => {
  await mountBatch02(page, "monaco", { nested: true });
  await expectNestedRealms(page);
  const parent = page.locator(".batch02-parent-scroll");
  expect(await parent.evaluate((element) => element.scrollTop)).toBe(180);
  expect(await page.evaluate(() => window.scrollY)).toBe(180);
  const root = page.locator(".batch02-monaco");
  const editor = root.locator(".monaco-editor");
  await editor.hover();
  // Native wheel deltas are normalized differently by each browser and Monaco.
  // Scroll with separate real wheel gestures until the editor has moved enough.
  for (let attempt = 0; attempt < 6; attempt++) {
    const before = Number(await root.getAttribute("data-editor-scroll") ?? 0);
    if (before >= 150) break;
    await page.mouse.wheel(0, 120);
    await expect.poll(async () => Number(await root.getAttribute("data-editor-scroll"))).toBeGreaterThan(before);
  }
  await expect.poll(async () => Number(await root.getAttribute("data-editor-scroll"))).toBeGreaterThan(100);
  const line = root.locator(".view-line").filter({ hasText: "const row16 = 16;" });
  await expect(line).toBeVisible();
  await line.hover({ trial: true });
  expect(await parent.evaluate((element) => element.scrollTop)).toBe(180);
  const hit = await line.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const text = walker.nextNode();
    if (!text || (text.textContent?.length ?? 0) < 6) throw new Error("Missing Monaco text node.");
    const range = document.createRange(); range.setStart(text, 6); range.setEnd(text, 7);
    const rect = range.getBoundingClientRect();
    return { x: rect.x + 0.25, y: rect.y + rect.height / 2 };
  });
  await page.mouse.click(hit.x, hit.y);
  await expect(root).toHaveAttribute("data-line", "16");
  await expect(root).toHaveAttribute("data-column", "7");
  await page.keyboard.type("X");
  await expect.poll(async () => (await root.getAttribute("data-value"))?.split("\n")[15]).toBe("const Xrow16 = 16;");
  await expect(parent).not.toHaveAttribute("data-error", /.+/);
});
