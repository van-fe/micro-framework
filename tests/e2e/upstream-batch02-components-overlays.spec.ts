import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";
import { destroyBatch02, mountBatch02 } from "./upstream-batch02-components-fixture";

isolateBrowserProcess(import.meta.url);
let errors: string[];
test.beforeEach(({ page }) => { errors = []; page.on("pageerror", (error) => errors.push(error.message)); });
test.afterEach(async ({ page }) => { await destroyBatch02(page); expect(errors).toEqual([]); });

test("W1106 Ant Design Vue default virtual Select scrolls by dragging its real scrollbar thumb", async ({ page }) => {
  await mountBatch02(page, "ant-select");
  await page.locator(".batch02-ant-select .ant-select-selector").click();
  const dropdown = page.locator(".ant-select-dropdown:visible");
  const holder = dropdown.locator(".rc-virtual-list-holder");
  await expect(dropdown).toBeVisible();
  await dropdown.hover();
  // Confirm virtualization, rather than accepting a nonvirtual 500-item replacement.
  expect(await dropdown.locator(".ant-select-item-option").count()).toBeLessThan(30);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => holder.evaluate((element) => element.scrollTop)).toBeGreaterThan(20);
  const before = await holder.evaluate((element) => element.scrollTop);
  const thumb = dropdown.locator(".rc-virtual-list-scrollbar-thumb");
  await expect(thumb).toBeVisible();
  const box = await thumb.boundingBox();
  if (!box) throw new Error("Virtual scrollbar thumb is missing.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 90, { steps: 12 });
  // AntDV renders thumb movement in requestAnimationFrame and cancels its pending
  // frame on mouseup. Observe the real drag while held before releasing it.
  await expect.poll(() => holder.evaluate((element) => element.scrollTop)).toBeGreaterThan(before + 500);
  // Finish the same owned drag outside the application, without changing its vertical position.
  await page.mouse.move(20, box.y + box.height / 2 + 90, { steps: 3 });
  await page.mouse.up();
  await expect.poll(() => holder.evaluate((element) => element.scrollTop)).toBeGreaterThan(before + 500);
  await expect(thumb).not.toHaveClass(/moving/);
  const option = dropdown.locator(".ant-select-item-option").nth(2);
  const label = (await option.innerText()).trim();
  await option.click();
  await expect(page.locator(".batch02-ant-select")).toHaveAttribute("data-selected", label.toLowerCase().replace(" ", "-"));
  await expect(page.locator(".batch02-ant-select")).toHaveAttribute("data-warnings", "[]");
});

test("W300 Element Plus validates trusted mouse and focus events without cross-Realm Vue warnings", async ({ page }) => {
  await mountBatch02(page, "events");
  const root = page.locator(".batch02-events");
  const input = root.getByPlaceholder("Event validation input");
  await input.hover();
  await input.click();
  await input.fill("Real native input");
  await root.getByRole("button", { name: "Validate click" }).click();
  await root.getByRole("button", { name: "Outside focus" }).click();
  await expect(root).toHaveAttribute("data-outside-clicked", "true");
  await expect(root).toHaveAttribute("data-warnings", "[]");
  const records = JSON.parse((await root.getAttribute("data-events"))!) as { type: string; mouse: boolean; focus: boolean; trusted: boolean }[];
  for (const type of ["mouseenter", "mouseleave", "click"]) {
    expect(records.some((event) => event.type === type && event.mouse && event.trusted)).toBe(true);
  }
  for (const type of ["focus", "blur"]) {
    expect(records.some((event) => event.type === type && event.focus && event.trusted)).toBe(true);
  }
});

for (const local of [false, true]) {
  test(`Q2408 Element UI Drawer Select focuses at its anchor (popperAppendToBody=${!local})`, async ({ page }) => {
    await mountBatch02(page, "drawer", { local });
    await page.getByRole("button", { name: "Open select drawer" }).click();
    const drawer = page.getByRole("dialog", { name: "Select within drawer" });
    await expect(drawer).toBeVisible();
    const input = drawer.getByPlaceholder("Drawer selection");
    await input.click();
    const menu = page.locator(".el-select-dropdown:visible");
    await expect(menu).toBeVisible();
    await expect.poll(async () => {
      const anchor = await input.boundingBox(); const floating = await menu.boundingBox();
      if (!anchor || !floating) return { alignedX: false, adjacentY: false };
      return {
        alignedX: Math.abs(floating.x - anchor.x) < 5,
        adjacentY: Math.min(Math.abs(floating.y - (anchor.y + anchor.height)), Math.abs(floating.y + floating.height - anchor.y)) < 16,
      };
    }).toEqual({ alignedX: true, adjacentY: true });
    if (local) expect(await menu.evaluate((element) => Boolean(element.closest(".el-select")))).toBe(true);
    await menu.getByText("South", { exact: true }).click();
    await expect(page.locator(".batch02-vue2-drawer")).toHaveAttribute("data-selected", "South");
    await expect(page.locator(".batch02-vue2-drawer")).toHaveAttribute("data-warnings", "[]");
  });
}

test("W1104 the Vue 2 lifecycle adapter does not declare an implicit reserved style prop", async ({ page }) => {
  await mountBatch02(page, "style-prop");
  const root = page.locator(".batch02-vue2-style-prop");
  await expect(root).toHaveAttribute("data-declared-props", "label");
  await expect(root).toHaveText("Initial business label");
  await page.evaluate(async () => { await window.__batch02Components__!.handle!.update({ label: "Updated business label" }); });
  await expect(root).toHaveText("Updated business label");
  await expect(root).toHaveAttribute("data-warnings", "[]");
});
