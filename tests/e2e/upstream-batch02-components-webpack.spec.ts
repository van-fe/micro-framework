import { expect, isolateBrowserProcess, test } from "./browser-process-fixture";
import { destroyBatch02, mountBatch02 } from "./upstream-batch02-components-fixture";
import { createWebpackReactFixture } from "./upstream-batch02-webpack-fixture";

isolateBrowserProcess(import.meta.url);
test("Q2298 a real Webpack React lazy chunk keeps a pre-existing global accessor writable", async ({ page }) => {
  const fixture = await createWebpackReactFixture();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await mountBatch02(page, "webpack", { entry: fixture.url, globalName: "__batch02WebpackApp__" });
    const root = page.locator(".batch02-webpack");
    await expect(root).toHaveAttribute("data-realm", "application");
    const before = Number(await root.getAttribute("data-setter-writes"));
    expect(before).toBeGreaterThan(0);
    await root.getByRole("button", { name: "Load real webpack chunk" }).click();
    await expect(root.locator("[data-chunk-message]")).toHaveText("Lazy chunk executed");
    await expect.poll(async () => Number(await root.getAttribute("data-setter-writes"))).toBeGreaterThan(before);
    expect(fixture.requests.some((path) => path.endsWith(".chunk.js"))).toBe(true);
    expect(await page.evaluate(() => "webpackChunkBatch02Accessor" in window || "__batch02WebpackApp__" in window)).toBe(false);
    expect(errors).toEqual([]);
  } finally { await destroyBatch02(page); await fixture.dispose(); }
});
