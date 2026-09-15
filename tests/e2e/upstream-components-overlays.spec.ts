import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";
import { componentEntry, destroyComponent, mountComponent } from "./upstream-components-fixture";

isolateBrowserProcess(import.meta.url);

let errors: string[];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => { await destroyComponent(page); expect(errors).toEqual([]); });

for (const keepAlive of [false, true]) {
  test(`W830 Naive UI select uses current trigger geometry after A-B-A switching (keepAlive=${keepAlive})`, async ({ page }) => {
    await mountComponent(page, "naive", keepAlive);
    for (let pass = 0; pass < 2; pass++) {
      const root = page.locator('.upstream-naive:visible');
      const trigger = root.locator(".n-base-selection");
      await trigger.click();
      const menu = page.locator(".n-base-select-menu:visible");
      await expect(menu).toBeVisible();
      const triggerBox = await trigger.boundingBox();
      const menuBox = await menu.boundingBox();
      if (!triggerBox || !menuBox) throw new Error("Missing Naive UI select geometry.");
      expect(Math.abs(menuBox.x - triggerBox.x)).toBeLessThan(3);
      expect(Math.abs(menuBox.y - (triggerBox.y + triggerBox.height))).toBeLessThan(16);
      await menu.getByText(pass === 0 ? "North" : "South", { exact: true }).click();
      await expect(root).toHaveAttribute("data-selection", pass === 0 ? "north" : "south");
      if (pass === 0) {
        await page.evaluate(async (entry) => {
          const state = window.__upstreamComponents__!;
          await state.handle.unmount();
          const other = await state.runtime.mountApp({
            name: "upstream-components-b", container: state.slot,
            entry: { type: "module", url: entry }, props: { scenario: "naive" },
          });
          await other.dispose();
          state.slot.style.marginLeft = "260px";
          await state.handle.mount();
          window.scrollTo(0, 360);
        }, componentEntry);
      }
    }
    expect(await page.evaluate(() => document.querySelector(".n-base-select-menu"))).toBeNull();
  });
}

test("W829 Recharts hits the lower chart area after the host page scrolls", async ({ page }) => {
  await mountComponent(page, "recharts");
  const chart = page.locator(".upstream-recharts .recharts-wrapper");
  await expect(chart.locator(".recharts-bar-rectangle")).toHaveCount(3);
  const beforeScroll = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollBy(0, 140));
  expect(await page.evaluate(() => window.scrollY)).toBe(beforeScroll + 140);
  const bars = chart.locator(".recharts-bar-rectangle");
  for (const [index, label] of ["North", "South", "East"].entries()) {
    await bars.nth(index).hover({ trial: true });
    const bar = await bars.nth(index).boundingBox();
    if (!bar) throw new Error("Missing Recharts bar geometry.");
    await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height - 8);
    const tooltip = chart.locator(".recharts-tooltip-wrapper");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText(label);
    const box = await tooltip.boundingBox();
    if (!box) throw new Error("Missing Recharts tooltip.");
    expect(box.y).toBeLessThan(bar.y + bar.height + 30);
  }
});

test("W896 Element Plus draggable dialog reaches the host viewport right and bottom boundaries", async ({ page }) => {
  await mountComponent(page, "dialog");
  await page.getByRole("button", { name: "Open draggable dialog" }).click();
  const dialog = page.getByRole("dialog", { name: "Drag to viewport edges" });
  await expect(dialog).toBeVisible();
  const header = dialog.locator(".el-dialog__header");
  await header.hover({ trial: true });
  const start = await header.boundingBox();
  const viewport = page.viewportSize()!;
  if (!start) throw new Error("Missing draggable dialog header.");
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewport.width - 2, viewport.height - 2, { steps: 30 });
  await page.mouse.up();
  const final = await dialog.boundingBox();
  if (!final) throw new Error("Missing dragged dialog.");
  expect(Math.abs(final.x + final.width - viewport.width)).toBeLessThan(4);
  expect(Math.abs(final.y + final.height - viewport.height)).toBeLessThan(4);
  await dialog.getByRole("button", { name: "Close this dialog" }).click();
  await expect(dialog).toBeHidden();
});
